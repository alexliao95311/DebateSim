import time
import psutil
import os
import requests
import json
from datetime import datetime
import re
from typing import Dict, Any, List

class DebateSimPerformanceMonitor:
    def __init__(self):
        self.base_url = "http://localhost:8000"
        self.results = []
        self.current_transcript: List[Dict[str, Any]] = []
        self.current_debate_rounds: List[Dict[str, Any]] = []
        
    def get_memory_usage(self):
        """Get current memory usage in MB"""
        process = psutil.Process(os.getpid())
        return process.memory_info().rss / 1024 / 1024
    
    def get_system_info(self):
        """Get system resource information"""
        return {
            'cpu_percent': psutil.cpu_percent(),
            'memory_percent': psutil.virtual_memory().percent,
            'memory_available': psutil.virtual_memory().available / 1024 / 1024
        }
    
    # ----------------------
    # Text-based metrics
    # ----------------------
    def _count_citations(self, text: str) -> int:
        if not text:
            return 0
        patterns = [
            r"\bH\.R\.\s?\d+\b",
            r"\bS\.\s?\d+\b",
            r"\bU\.S\.C\.\b",
            r"\bSection\s+\d+[A-Za-z\-\.]*\b",
            r"\bSec\.\s*\d+\b",
            r"\b\d+\s*U\.S\.C\.\s*\d+\b",
            r"\bTitle\s+[IVXLCM]+\b",
            r"§\s*\d+"
        ]
        return sum(len(re.findall(p, text)) for p in patterns)

    def _legislative_reference_density(self, text: str) -> float:
        if not text:
            return 0.0
        return 1000.0 * self._count_citations(text) / max(len(text), 1)

    def _argument_count(self, text: str) -> int:
        if not text:
            return 0
        # Look for enumerated arguments (1., 2., 3. or "Argument 1", etc.)
        patterns = [r"\b(1|2|3|4|5)\)\s", r"\b(1|2|3|4|5)\.\s", r"Argument\s+(One|Two|Three|Four|Five)", r"Argument\s+\d+"]
        return max(sum(len(re.findall(p, text, flags=re.IGNORECASE)) for p in patterns), 1 if len(text.split("\n\n")) >= 3 else 0)

    def _structural_compliance_three_points(self, text: str) -> bool:
        return self._argument_count(text) == 3

    def _rebuttal_reference_rate(self, text: str) -> float:
        if not text:
            return 0.0
        # Count references to the opponent
        cues = [
            r"you (claim|argue|said|assert)", r"your (argument|claim|point)", r"as (you|the opponent) (noted|said)",
            r"my opponent", r"the opposition", r"they (claimed|argued|said)"
        ]
        sentences = re.split(r"(?<=[\.!?])\s+", text)
        if not sentences:
            return 0.0
        ref_count = 0
        for s in sentences:
            if any(re.search(c, s, flags=re.IGNORECASE) for c in cues):
                ref_count += 1
        return ref_count / len(sentences)

    def _evidence_usage_score(self, text: str) -> float:
        if not text:
            return 0.0
        # Proxy: numbers, percentages, years, citations
        numbers = len(re.findall(r"\b\d{1,4}\b", text))
        percents = len(re.findall(r"\b\d+%\b", text))
        years = len(re.findall(r"\b(19|20)\d{2}\b", text))
        citations = self._count_citations(text)
        length_k = max(len(text) / 1000.0, 1.0)
        return (numbers + 2*percents + 1.5*years + 3*citations) / length_k

    def _weighing_presence(self, text: str) -> float:
        if not text:
            return 0.0
        terms = ["weigh", "impact", "magnitude", "probability", "timeframe", "risk", "benefit", "tradeoff", "cost"]
        hits = sum(1 for t in terms if re.search(rf"\b{re.escape(t)}\w*\b", text, flags=re.IGNORECASE))
        return hits / len(terms)

    def _readability_proxy(self, text: str) -> float:
        if not text:
            return 0.0
        words = re.findall(r"[A-Za-z]+", text)
        sentences = max(len(re.findall(r"[\.!?]", text)), 1)
        avg_word_len = sum(len(w) for w in words) / max(len(words), 1)
        avg_sent_len = len(words) / sentences
        # Lower is easier; invert to make higher better
        score = 100.0 / (1.0 + 0.5*avg_word_len + 0.05*avg_sent_len)
        return score

    def _qualitative_metrics(self, text: str, round_num: int, debater_role: str) -> Dict[str, Any]:
        return {
            'argument_count': self._argument_count(text),
            'structural_compliance_three_points': self._structural_compliance_three_points(text) if (round_num == 1 and debater_role.lower() == 'pro') else None,
            'citation_count': self._count_citations(text),
            'legislative_reference_density_per_1k': self._legislative_reference_density(text),
            'rebuttal_reference_rate': self._rebuttal_reference_rate(text) if round_num in (2,3,4) else None,
            'evidence_usage_score': self._evidence_usage_score(text),
            'weighing_presence': self._weighing_presence(text) if round_num == 5 else None,
            'readability_proxy': self._readability_proxy(text)
        }

    def _estimate_tokens(self, text: str) -> int:
        if not text:
            return 0
        # Rough heuristic
        return max(1, int(len(text) / 4))
    
    def measure_debate_round(self, round_data):
        """Measure performance for a single debate round"""
        print(f"Starting Round {round_data['round_num']}...")
        
        # Measure memory before
        memory_before = self.get_memory_usage()
        system_before = self.get_system_info()
        
        # Include full transcript for context if available
        full_transcript = "\n".join([
            f"[{t['round_num']}][{t['debater'].upper()}] {t['text']}" for t in self.current_transcript
        ]) if self.current_transcript else ""
        round_data_with_context = dict(round_data)
        if full_transcript:
            round_data_with_context['full_transcript'] = full_transcript
        
        # Measure response time
        start_time = time.time()
        try:
            response = requests.post(f"{self.base_url}/generate-response", 
                                  json=round_data_with_context, timeout=120)
            end_time = time.time()
            
            if response.status_code == 200:
                response_json = response.json()
                ai_text = response_json.get('response', '')
                response_time = end_time - start_time
                
                # Measure memory after
                memory_after = self.get_memory_usage()
                system_after = self.get_system_info()
                
                # Calculate metrics
                memory_used = memory_after - memory_before
                response_size = len(response.content)
                
                # Extract token usage if available in headers; else estimate
                input_tokens = response.headers.get('x-usage-input-tokens')
                output_tokens = response.headers.get('x-usage-output-tokens')
                if input_tokens is None:
                    input_tokens = self._estimate_tokens(json.dumps(round_data_with_context))
                if output_tokens is None:
                    output_tokens = self._estimate_tokens(ai_text)
                
                qualitative = self._qualitative_metrics(ai_text, round_data['round_num'], round_data['debater'])
                
                round_metrics = {
                    'round_num': round_data['round_num'],
                    'debater_role': round_data['debater'],
                    'response_time': response_time,
                    'memory_before': memory_before,
                    'memory_after': memory_after,
                    'memory_used': memory_used,
                    'response_size': response_size,
                    'input_tokens': input_tokens,
                    'output_tokens': output_tokens,
                    'cpu_before': system_before['cpu_percent'],
                    'cpu_after': system_after['cpu_percent'],
                    'status_code': response.status_code,
                    'timestamp': datetime.now().isoformat(),
                    'text': ai_text,
                    'metrics': qualitative
                }
                
                self.results.append(round_metrics)
                self.current_debate_rounds.append(round_metrics)
                self.current_transcript.append({'round_num': round_data['round_num'], 'debater': round_data['debater'], 'text': ai_text})
                print(f"Round {round_data['round_num']} completed in {response_time:.2f}s")
                print(f"Memory used: {memory_used:.2f} MB")
                
                return round_metrics
                
            else:
                print(f"Error: Status code {response.status_code}")
                return None
                
        except Exception as e:
            print(f"Error in round {round_data['round_num']}: {e}")
            return None
    
    def _compute_drift(self, rounds: List[Dict[str, Any]]) -> Dict[str, Any]:
        if not rounds:
            return {}
        # Track drift for key quality metrics
        by_round = {r['round_num']: r for r in rounds}
        first = by_round.get(1)
        last = by_round.get(max(by_round.keys()))
        def safe(v):
            return v if isinstance(v, (int, float)) else (v if v is not None else 0.0)
        drift = {}
        if first and last:
            drift['citation_density_delta'] = safe(last['metrics']['legislative_reference_density_per_1k']) - safe(first['metrics']['legislative_reference_density_per_1k'])
            drift['evidence_usage_delta'] = safe(last['metrics']['evidence_usage_score']) - safe(first['metrics']['evidence_usage_score'])
            drift['readability_delta'] = safe(last['metrics']['readability_proxy']) - safe(first['metrics']['readability_proxy'])
        # Rebuttal reference improvement between first rebuttal round and later rebuttals
        rebuttal_rounds = [r for r in rounds if r['round_num'] in (2,3,4) and r['metrics']['rebuttal_reference_rate'] is not None]
        if len(rebuttal_rounds) >= 2:
            drift['rebuttal_reference_trend'] = rebuttal_rounds[-1]['metrics']['rebuttal_reference_rate'] - rebuttal_rounds[0]['metrics']['rebuttal_reference_rate']
        # Weighing presence captured in round 5
        if last and last['round_num'] == 5:
            drift['weighing_presence_final'] = safe(last['metrics']['weighing_presence'])
        # Structural compliance captured in round 1
        if first:
            drift['structural_compliance_opening'] = bool(first['metrics']['structural_compliance_three_points']) if first['metrics'].get('structural_compliance_three_points') is not None else None
        return drift

    def _judge_feedback(self) -> Dict[str, Any]:
        if not self.current_transcript:
            return {}
        full_transcript = "\n".join([
            f"[{t['round_num']}][{t['debater'].upper()}] {t['text']}" for t in self.current_transcript
        ])
        try:
            resp = requests.post(f"{self.base_url}/judge-debate", json={"transcript": full_transcript, "model": "openai/gpt-5-mini"}, timeout=120)
            if resp.status_code != 200:
                return {'status_code': resp.status_code, 'feedback': None}
            feedback_text = resp.json().get('feedback', '')
            # Try to extract a winner if present
            winner = None
            m = re.search(r"winner\s*:\s*(pro|con)", feedback_text, flags=re.IGNORECASE)
            if m:
                winner = m.group(1).lower()
            return {'status_code': 200, 'feedback': feedback_text, 'winner': winner}
        except Exception as e:
            return {'status_code': 'error', 'error': str(e)}
    
    def run_complete_debate(self, bill_topic, bill_description):
        """Run a complete 5-round debate and collect metrics"""
        print(f"\n=== Starting Complete Debate: {bill_topic} ===\n")
        
        # Reset per-debate state
        self.current_transcript = []
        self.current_debate_rounds = []
        
        debate_start_time = time.time()
        debate_memory_start = self.get_memory_usage()
        
        # Round 1: Pro constructive
        round1_data = {
            "debater": "pro",
            "prompt": bill_topic,
            "model": "openai/gpt-5-mini",
            "bill_description": bill_description,
            "round_num": 1
        }
        self.measure_debate_round(round1_data)
        
        # Round 2: Con constructive + rebuttal
        round2_data = {
            "debater": "con",
            "prompt": bill_topic,
            "model": "openai/gpt-5-mini",
            "bill_description": bill_description,
            "round_num": 2
        }
        self.measure_debate_round(round2_data)
        
        # Round 3: Pro rebuttal
        round3_data = {
            "debater": "pro",
            "prompt": bill_topic,
            "model": "openai/gpt-5-mini",
            "bill_description": bill_description,
            "round_num": 3
        }
        self.measure_debate_round(round3_data)
        
        # Round 4: Con rebuttal
        round4_data = {
            "debater": "con",
            "prompt": bill_topic,
            "model": "openai/gpt-5-mini",
            "bill_description": bill_description,
            "round_num": 4
        }
        self.measure_debate_round(round4_data)
        
        # Round 5: Final weighing (Pro closes by default)
        round5_data = {
            "debater": "pro",
            "prompt": bill_topic,
            "model": "openai/gpt-5-mini",
            "bill_description": bill_description,
            "round_num": 5
        }
        self.measure_debate_round(round5_data)
        
        # Debate summary
        debate_end_time = time.time()
        debate_memory_end = self.get_memory_usage()
        
        debate_summary = {
            'bill_topic': bill_topic,
            'total_time': debate_end_time - debate_start_time,
            'total_memory_used': debate_memory_end - debate_memory_start,
            'rounds_completed': len(self.current_debate_rounds),
            'average_response_time': sum(r['response_time'] for r in self.current_debate_rounds) / max(len(self.current_debate_rounds), 1),
            'total_memory_peak': max(r['memory_after'] for r in self.current_debate_rounds) if self.current_debate_rounds else 0.0
        }
        
        judge = self._judge_feedback()
        drift = self._compute_drift(self.current_debate_rounds)
        
        print(f"\n=== Debate Complete ===")
        print(f"Total time: {debate_summary['total_time']:.2f}s")
        print(f"Average response time: {debate_summary['average_response_time']:.2f}s")
        print(f"Total memory used: {debate_summary['total_memory_used']:.2f} MB")
        
        # Write organized raw data through json_generator
        try:
            from .json_generator import write_raw_metrics  # relative import if run as module
        except Exception:
            try:
                from json_generator import write_raw_metrics
            except Exception:
                write_raw_metrics = None
        if write_raw_metrics:
            organized = {
                'metadata': {
                    'topic': bill_topic,
                    'description': bill_description,
                    'timestamp': datetime.now().isoformat()
                },
                'rounds': self.current_debate_rounds,
                'transcript': "\n".join([f"[{t['round_num']}][{t['debater'].upper()}] {t['text']}" for t in self.current_transcript]),
                'judge': judge,
                'summary': debate_summary,
                'drift': drift
            }
            # Default path within repo
            default_json_path = os.path.join(os.path.dirname(__file__), 'data', 'raw_metrics.json')
            try:
                write_raw_metrics(default_json_path, organized)
                print(f"Raw metrics appended to {default_json_path}")
            except Exception as e:
                print(f"Failed to write raw metrics JSON: {e}")
        
        return {
            'summary': debate_summary,
            'drift': drift,
            'judge': judge
        }
    
    def test_concurrency(self, num_concurrent=3):
        """Test system performance with multiple concurrent debates"""
        print(f"\n=== Testing Concurrency with {num_concurrent} debates ===\n")
        
        import threading
        
        # Test data for multiple debates
        test_debates = [
            ("H.R. 40 - Reparations Study", "Commission to study reparation proposals"),
            ("H.R. 1 - Comprehensive Legislation", "Voting rights and campaign finance"),
            ("H.R. 2 - Infrastructure Bill", "National infrastructure development")
        ]
        
        threads = []
        results = []
        
        def run_debate_thread(debate_data):
            result = self.run_complete_debate(debate_data[0], debate_data[1])
            results.append(result)
        
        # Start concurrent debates
        start_time = time.time()
        for i in range(min(num_concurrent, len(test_debates))):
            thread = threading.Thread(target=run_debate_thread, args=(test_debates[i],))
            threads.append(thread)
            thread.start()
        
        # Wait for all to complete
        for thread in threads:
            thread.join()
        
        end_time = time.time()
        
        concurrency_summary = {
            'num_concurrent': num_concurrent,
            'total_time': end_time - start_time,
            'average_debate_time': sum(r['summary']['total_time'] for r in results) / max(len(results), 1),
            'performance_degradation': 'Yes' if end_time - start_time > sum(r['summary']['total_time'] for r in results) else 'No'
        }
        
        print(f"\n=== Concurrency Test Complete ===")
        print(f"Concurrent debates: {num_concurrent}")
        print(f"Total time: {concurrency_summary['total_time']:.2f}s")
        print(f"Performance degradation: {concurrency_summary['performance_degradation']}")
        
        return concurrency_summary
    
    def save_results(self, filename="debatesim_performance_results.json"):
        """Save all collected metrics to a JSON file"""
        with open(filename, 'w') as f:
            json.dump({
                'round_metrics': self.results,
                'timestamp': datetime.now().isoformat(),
                'summary': {
                    'total_rounds': len(self.results),
                    'average_response_time': sum(r['response_time'] for r in self.results) / max(len(self.results), 1) if self.results else 0,
                    'total_memory_used': sum(r['memory_used'] for r in self.results) if self.results else 0,
                    'success_rate': len([r for r in self.results if r['status_code'] == 200]) / max(len(self.results), 1) if self.results else 0
                }
            }, f, indent=2)
        
        print(f"\nResults saved to {filename}")
    
    def print_summary(self):
        """Print a summary of all collected metrics"""
        if not self.results:
            print("No results to display")
            return
        
        print("\n" + "="*50)
        print("DEBATESIM PERFORMANCE SUMMARY")
        print("="*50)
        
        response_times = [r['response_time'] for r in self.results]
        memory_usage = [r['memory_used'] for r in self.results]
        
        print(f"Total rounds completed: {len(self.results)}")
        print(f"Average response time: {sum(response_times)/len(response_times):.2f}s")
        print(f"Fastest response: {min(response_times):.2f}s")
        print(f"Slowest response: {max(response_times):.2f}s")
        print(f"Average memory per round: {sum(memory_usage)/len(memory_usage):.2f} MB")
        print(f"Total memory used: {sum(memory_usage):.2f} MB")
        
        # Success rate
        successful_rounds = len([r for r in self.results if r['status_code'] == 200])
        print(f"Success rate: {successful_rounds}/{len(self.results)} ({100*successful_rounds/len(self.results):.1f}%)")

if __name__ == "__main__":
    monitor = DebateSimPerformanceMonitor()
    
    # Test H.R. 40
    print("Testing H.R. 40 debate...")
    hr40 = monitor.run_complete_debate(
        "H.R. 40 - Commission to Study and Develop Reparation Proposals for African-Americans Act",
        "This bill establishes a commission to study and develop reparation proposals for African-Americans."
    )
    
    # Test H.R. 1
    print("\nTesting H.R. 1 debate...")
    hr1 = monitor.run_complete_debate(
        "H.R. 1 - One Big Beautiful Bill Act",
        "This bill addresses multiple policy areas including voting rights, campaign finance, and government ethics."
    )
    
    # Test concurrency
    print("\nTesting concurrency...")
    concurrency_summary = monitor.test_concurrency(3)
    
    # Save and display results
    monitor.save_results()
    monitor.print_summary()