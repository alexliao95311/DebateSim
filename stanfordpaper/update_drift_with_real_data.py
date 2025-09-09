#!/usr/bin/env python3
"""
Update drift analysis to use real AI responses from debate transcripts.
"""

import os
import re
from pathlib import Path

def extract_real_responses():
    """Extract real AI responses from debate transcripts"""
    
    # Extract from H.R. 40 transcript
    hr40_responses = []
    with open('hr40_debate_transcript.txt', 'r') as f:
        content = f.read()
    
    # Split by rounds
    rounds = content.split('AI Debater')[1:]  # Skip header
    
    for i, round_content in enumerate(rounds):
        lines = round_content.strip().split('\n')
        if len(lines) > 1:
            # Extract the actual response content (skip headers)
            response_lines = []
            for line in lines[2:]:  # Skip round header and model info
                if line.strip() and not line.startswith('Model:'):
                    response_lines.append(line)
            
            if response_lines:
                hr40_responses.append({
                    'round': i + 1,
                    'content': '\n'.join(response_lines),
                    'source': 'hr40'
                })
    
    # Extract from H.R. 1 transcript
    hr1_responses = []
    with open('hr1_debate_transcript.txt', 'r') as f:
        content = f.read()
    
    rounds = content.split('AI Debater')[1:]  # Skip header
    
    for i, round_content in enumerate(rounds):
        lines = round_content.strip().split('\n')
        if len(lines) > 1:
            response_lines = []
            for line in lines[2:]:  # Skip round header and model info
                if line.strip() and not line.startswith('Model:'):
                    response_lines.append(line)
            
            if response_lines:
                hr1_responses.append({
                    'round': i + 1,
                    'content': '\n'.join(response_lines),
                    'source': 'hr1'
                })
    
    return hr40_responses + hr1_responses

def update_drift_analyzer_with_real_data():
    """Update drift analyzer to use real responses"""
    
    # Extract real responses
    real_responses = extract_real_responses()
    
    # Create a new drift analyzer that uses real data
    drift_file = 'drift_analysis/drift_analyzer.py'
    
    with open(drift_file, 'r') as f:
        content = f.read()
    
    # Add method to load real responses
    new_method = '''
    def load_real_responses(self):
        """Load real AI responses from debate transcripts"""
        hr40_responses = []
        with open('hr40_debate_transcript.txt', 'r') as f:
            content = f.read()
        
        # Split by rounds
        rounds = content.split('AI Debater')[1:]  # Skip header
        
        for i, round_content in enumerate(rounds):
            lines = round_content.strip().split('\\n')
            if len(lines) > 1:
                response_lines = []
                for line in lines[2:]:  # Skip round header and model info
                    if line.strip() and not line.startswith('Model:'):
                        response_lines.append(line)
                
                if response_lines:
                    hr40_responses.append('\\n'.join(response_lines))
        
        # Extract from H.R. 1 transcript
        hr1_responses = []
        with open('hr1_debate_transcript.txt', 'r') as f:
            content = f.read()
        
        rounds = content.split('AI Debater')[1:]  # Skip header
        
        for i, round_content in enumerate(rounds):
            lines = round_content.strip().split('\\n')
            if len(lines) > 1:
                response_lines = []
                for line in lines[2:]:  # Skip round header and model info
                    if line.strip() and not line.startswith('Model:'):
                        response_lines.append(line)
                
                if response_lines:
                    hr1_responses.append('\\n'.join(response_lines))
        
        return hr40_responses + hr1_responses
    
    def run_real_drift_analysis(self):
        """Run drift analysis on real AI responses"""
        print("Loading real AI responses from debate transcripts...")
        real_responses = self.load_real_responses()
        
        if len(real_responses) < 2:
            print("Need at least 2 responses for drift analysis")
            return None
        
        print(f"Analyzing drift across {len(real_responses)} real AI responses...")
        
        # Analyze drift between consecutive responses
        drift_results = []
        for i in range(len(real_responses) - 1):
            response1 = real_responses[i]
            response2 = real_responses[i + 1]
            
            # Vectorize both responses
            vector1 = self.vectorize_prompt(response1)
            vector2 = self.vectorize_prompt(response2)
            
            # Calculate drift metrics
            metrics = self.compute_drift_metrics(
                response1, response2,
                response1, response2  # Using same text for input/output
            )
            
            drift_results.append(metrics)
            print(f"Response {i+1} -> {i+2}: Drift Score = {metrics.overall_drift_score:.3f}")
        
        # Calculate average drift
        avg_drift = sum(r.overall_drift_score for r in drift_results) / len(drift_results)
        print(f"Average drift across real responses: {avg_drift:.3f}")
        
        return drift_results
'''
    
    # Insert the new methods before the main execution block
    insertion_point = 'if __name__ == "__main__":'
    new_content = content.replace(insertion_point, new_method + '\n\n' + insertion_point)
    
    # Update the main execution to use real data
    new_main = '''if __name__ == "__main__":
    # Initialize drift analyzer
    analyzer = DriftAnalyzer()
    
    # Run real drift analysis
    print("Running drift analysis on real AI responses...")
    real_results = analyzer.run_real_drift_analysis()
    
    if real_results:
        # Save real results
        filename = analyzer.save_drift_analysis()
        print(f"Real drift analysis saved to: {filename}")
    else:
        print("Failed to run real drift analysis")'''
    
    # Replace the main block
    pattern = r'if __name__ == "__main__":.*'
    new_content = re.sub(pattern, new_main, new_content, flags=re.DOTALL)
    
    # Write the updated file
    with open(drift_file, 'w') as f:
        f.write(new_content)
    
    print(f"✅ Updated {drift_file} to use real AI response data")

if __name__ == "__main__":
    print("🔄 Updating drift analysis to use real data...")
    update_drift_analyzer_with_real_data()
    print("✅ Drift analysis now uses real AI response data!")
