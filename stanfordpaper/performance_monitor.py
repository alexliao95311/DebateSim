import time
import psutil
import os
import requests
import json
from datetime import datetime

class DebateSimPerformanceMonitor:
    def __init__(self):
        self.base_url = "http://localhost:8000"
        self.results = []
        
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
    
    def measure_debate_round(self, round_data):
        """Measure performance for a single debate round"""
        print(f"Starting Round {round_data['round_num']}...")
        
        # Measure memory before
        memory_before = self.get_memory_usage()
        system_before = self.get_system_info()
        
        # Measure response time
        start_time = time.time()
        try:
            response = requests.post(f"{self.base_url}/generate-response", 
                                  json=round_data, timeout=60)
            end_time = time.time()
            
            if response.status_code == 200:
                response_data = response.json()
                response_time = end_time - start_time
                
                # Measure memory after
                memory_after = self.get_memory_usage()
                system_after = self.get_system_info()
                
                # Calculate metrics
                memory_used = memory_after - memory_before
                response_size = len(response.content)
                
                # Extract token usage if available in headers
                input_tokens = response.headers.get('x-usage-input-tokens', 'N/A')
                output_tokens = response.headers.get('x-usage-output-tokens', 'N/A')
                
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
                    'timestamp': datetime.now().isoformat()
                }
                
                self.results.append(round_metrics)
                print(f"Round {round_data['round_num']} completed in {response_time:.2f}s")
                print(f"Memory used: {memory_used:.2f} MB")
                
                return round_metrics
                
            else:
                print(f"Error: Status code {response.status_code}")
                return None
                
        except Exception as e:
            print(f"Error in round {round_data['round_num']}: {e}")
            return None
    
    def run_complete_debate(self, bill_topic, bill_description):
        """Run a complete 5-round debate and collect metrics"""
        print(f"\n=== Starting Complete Debate: {bill_topic} ===\n")
        
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
        
        # Round 5: Final weighing
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
            'rounds_completed': len(self.results),
            'average_response_time': sum(r['response_time'] for r in self.results) / len(self.results),
            'total_memory_peak': max(r['memory_after'] for r in self.results)
        }
        
        print(f"\n=== Debate Complete ===")
        print(f"Total time: {debate_summary['total_time']:.2f}s")
        print(f"Average response time: {debate_summary['average_response_time']:.2f}s")
        print(f"Total memory used: {debate_summary['total_memory_used']:.2f} MB")
        
        return debate_summary
    
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
            'average_debate_time': sum(r['total_time'] for r in results) / len(results),
            'performance_degradation': 'Yes' if end_time - start_time > sum(r['total_time'] for r in results) else 'No'
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
                    'average_response_time': sum(r['response_time'] for r in self.results) / len(self.results),
                    'total_memory_used': sum(r['memory_used'] for r in self.results),
                    'success_rate': len([r for r in self.results if r['status_code'] == 200]) / len(self.results)
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
    hr40_summary = monitor.run_complete_debate(
        "H.R. 40 - Commission to Study and Develop Reparation Proposals for African-Americans Act",
        "This bill establishes a commission to study and develop reparation proposals for African-Americans."
    )
    
    # Test H.R. 1
    print("\nTesting H.R. 1 debate...")
    hr1_summary = monitor.run_complete_debate(
        "H.R. 1 - One Big Beautiful Bill Act",
        "This bill addresses multiple policy areas including voting rights, campaign finance, and government ethics."
    )
    
    # Test concurrency
    print("\nTesting concurrency...")
    concurrency_summary = monitor.test_concurrency(3)
    
    # Save and display results
    monitor.save_results()
    monitor.print_summary()
