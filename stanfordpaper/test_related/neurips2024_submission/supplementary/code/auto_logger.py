"""
Auto-Logging System for AI Debate Models

This module implements a comprehensive auto-logging system that tracks inputs, outputs,
drift metrics, and performance data for the AI Debate Model & Drift Analysis system.
"""

import json
import os
import sqlite3
import hashlib
from datetime import datetime
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, asdict
from pathlib import Path
import logging
import threading
from queue import Queue
import time

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

@dataclass
class LogEntry:
    """Individual log entry for tracking debate interactions"""
    entry_id: str
    session_id: str
    timestamp: str
    entry_type: str  # "input", "output", "drift", "performance", "error"
    data: Dict[str, Any]
    metadata: Dict[str, Any] = None

@dataclass
class DebateSession:
    """Container for a complete debate session"""
    session_id: str
    game_id: str
    topic: str
    model_configs: Dict[str, Any]
    start_time: str
    end_time: Optional[str] = None
    total_rounds: int = 0
    status: str = "active"  # "active", "completed", "error"
    performance_summary: Dict[str, Any] = None

class AutoLogger:
    """
    Comprehensive auto-logging system for tracking all aspects of AI debate interactions.
    
    This system automatically logs inputs, outputs, drift metrics, and performance data
    to ensure complete traceability and analysis capabilities.
    """
    
    def __init__(self, log_dir: str = "stanfordpaper/logs", use_database: bool = True):
        """
        Initialize the auto-logging system.
        
        Args:
            log_dir: Directory to store log files
            use_database: Whether to use SQLite database for structured logging
        """
        self.log_dir = Path(log_dir)
        self.use_database = use_database
        
        # Ensure log directory exists
        self.log_dir.mkdir(parents=True, exist_ok=True)
        
        # Initialize logging components
        self.active_sessions: Dict[str, DebateSession] = {}
        self.log_queue = Queue()
        self.log_thread = None
        self.running = False
        
        # Initialize database if enabled
        if self.use_database:
            self.db_path = self.log_dir / "debate_logs.db"
            self._init_database()
        
        # Initialize JSON logging
        self.json_log_dir = self.log_dir / "json_logs"
        self.json_log_dir.mkdir(exist_ok=True)
        
        # Start background logging thread
        self.start_logging()
    
    def _init_database(self):
        """Initialize SQLite database for structured logging"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create tables
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS log_entries (
                entry_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                timestamp TEXT NOT NULL,
                entry_type TEXT NOT NULL,
                data TEXT NOT NULL,
                metadata TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS debate_sessions (
                session_id TEXT PRIMARY KEY,
                game_id TEXT NOT NULL,
                topic TEXT NOT NULL,
                model_configs TEXT NOT NULL,
                start_time TEXT NOT NULL,
                end_time TEXT,
                total_rounds INTEGER DEFAULT 0,
                status TEXT DEFAULT 'active',
                performance_summary TEXT,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS drift_metrics (
                metric_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                round_number INTEGER NOT NULL,
                prompt_hash TEXT NOT NULL,
                semantic_distance REAL,
                token_variation REAL,
                argument_structure_drift REAL,
                evidence_consistency REAL,
                overall_drift_score REAL,
                timestamp TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS performance_metrics (
                metric_id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                round_number INTEGER NOT NULL,
                response_time REAL,
                memory_usage REAL,
                token_count INTEGER,
                model_name TEXT,
                timestamp TEXT NOT NULL,
                created_at DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        ''')
        
        # Create indexes for better performance
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_session_id ON log_entries(session_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_entry_type ON log_entries(entry_type)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_timestamp ON log_entries(timestamp)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_drift_session ON drift_metrics(session_id)')
        cursor.execute('CREATE INDEX IF NOT EXISTS idx_performance_session ON performance_metrics(session_id)')
        
        conn.commit()
        conn.close()
    
    def start_logging(self):
        """Start the background logging thread"""
        if not self.running:
            self.running = True
            self.log_thread = threading.Thread(target=self._log_worker, daemon=True)
            self.log_thread.start()
            logger.info("Auto-logging system started")
    
    def stop_logging(self):
        """Stop the background logging thread"""
        if self.running:
            self.running = False
            self.log_queue.put(None)  # Signal to stop
            if self.log_thread:
                self.log_thread.join()
            logger.info("Auto-logging system stopped")
    
    def _log_worker(self):
        """Background worker thread for processing log entries"""
        while self.running:
            try:
                entry = self.log_queue.get(timeout=1)
                if entry is None:  # Stop signal
                    break
                
                self._process_log_entry(entry)
                self.log_queue.task_done()
            except:
                continue
    
    def _process_log_entry(self, entry: LogEntry):
        """Process a single log entry"""
        try:
            # Log to database if enabled
            if self.use_database:
                self._log_to_database(entry)
            
            # Log to JSON file
            self._log_to_json(entry)
            
        except Exception as e:
            logger.error(f"Error processing log entry: {e}")
    
    def _log_to_database(self, entry: LogEntry):
        """Log entry to SQLite database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO log_entries 
            (entry_id, session_id, timestamp, entry_type, data, metadata)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (
            entry.entry_id,
            entry.session_id,
            entry.timestamp,
            entry.entry_type,
            json.dumps(entry.data),
            json.dumps(entry.metadata) if entry.metadata else None
        ))
        
        conn.commit()
        conn.close()
    
    def _log_to_json(self, entry: LogEntry):
        """Log entry to JSON file"""
        # Create session-specific log file
        session_log_file = self.json_log_dir / f"session_{entry.session_id}.json"
        
        # Load existing entries or create new list
        if session_log_file.exists():
            with open(session_log_file, 'r') as f:
                entries = json.load(f)
        else:
            entries = []
        
        # Add new entry
        entries.append(asdict(entry))
        
        # Save back to file
        with open(session_log_file, 'w') as f:
            json.dump(entries, f, indent=2)
    
    def create_session(self, 
                      session_id: str, 
                      game_id: str, 
                      topic: str, 
                      model_configs: Dict[str, Any]) -> DebateSession:
        """
        Create a new debate session for logging.
        
        Args:
            session_id: Unique session identifier
            game_id: Associated game state ID
            topic: Debate topic
            model_configs: Model configurations for the session
            
        Returns:
            DebateSession object
        """
        session = DebateSession(
            session_id=session_id,
            game_id=game_id,
            topic=topic,
            model_configs=model_configs,
            start_time=datetime.now().isoformat()
        )
        
        self.active_sessions[session_id] = session
        
        # Log session creation
        self.log_entry(
            session_id=session_id,
            entry_type="session_created",
            data={
                "game_id": game_id,
                "topic": topic,
                "model_configs": model_configs
            },
            metadata={"action": "create_session"}
        )
        
        logger.info(f"Created logging session: {session_id}")
        return session
    
    def log_entry(self, 
                  session_id: str, 
                  entry_type: str, 
                  data: Dict[str, Any], 
                  metadata: Dict[str, Any] = None) -> str:
        """
        Log a new entry to the system.
        
        Args:
            session_id: Session identifier
            entry_type: Type of entry (input, output, drift, performance, error)
            data: Entry data
            metadata: Additional metadata
            
        Returns:
            Entry ID
        """
        entry_id = self._generate_entry_id(session_id, entry_type)
        
        entry = LogEntry(
            entry_id=entry_id,
            session_id=session_id,
            timestamp=datetime.now().isoformat(),
            entry_type=entry_type,
            data=data,
            metadata=metadata
        )
        
        # Add to queue for background processing
        self.log_queue.put(entry)
        
        return entry_id
    
    def log_input(self, 
                  session_id: str, 
                  prompt: str, 
                  model_name: str, 
                  round_num: int = None,
                  additional_data: Dict[str, Any] = None) -> str:
        """
        Log a model input (prompt).
        
        Args:
            session_id: Session identifier
            prompt: Input prompt
            model_name: Model being used
            round_num: Round number (optional)
            additional_data: Additional input data
            
        Returns:
            Entry ID
        """
        data = {
            "prompt": prompt,
            "model_name": model_name,
            "prompt_hash": hashlib.md5(prompt.encode()).hexdigest(),
            "prompt_length": len(prompt),
            "word_count": len(prompt.split())
        }
        
        if round_num is not None:
            data["round_num"] = round_num
        
        if additional_data:
            data.update(additional_data)
        
        return self.log_entry(
            session_id=session_id,
            entry_type="input",
            data=data,
            metadata={"action": "log_input"}
        )
    
    def log_output(self, 
                   session_id: str, 
                   response: str, 
                   model_name: str, 
                   response_time: float = None,
                   round_num: int = None,
                   additional_data: Dict[str, Any] = None) -> str:
        """
        Log a model output (response).
        
        Args:
            session_id: Session identifier
            response: Model response
            model_name: Model that generated the response
            response_time: Time taken to generate response
            round_num: Round number (optional)
            additional_data: Additional output data
            
        Returns:
            Entry ID
        """
        data = {
            "response": response,
            "model_name": model_name,
            "response_hash": hashlib.md5(response.encode()).hexdigest(),
            "response_length": len(response),
            "word_count": len(response.split())
        }
        
        if response_time is not None:
            data["response_time"] = response_time
        
        if round_num is not None:
            data["round_num"] = round_num
        
        if additional_data:
            data.update(additional_data)
        
        return self.log_entry(
            session_id=session_id,
            entry_type="output",
            data=data,
            metadata={"action": "log_output"}
        )
    
    def log_drift_metrics(self, 
                         session_id: str, 
                         drift_metrics: Dict[str, Any], 
                         round_num: int = None) -> str:
        """
        Log drift analysis metrics.
        
        Args:
            session_id: Session identifier
            drift_metrics: Drift analysis results
            round_num: Round number (optional)
            
        Returns:
            Entry ID
        """
        data = {
            "drift_metrics": drift_metrics,
            "overall_drift_score": drift_metrics.get("overall_drift_score", 0.0)
        }
        
        if round_num is not None:
            data["round_num"] = round_num
        
        # Also log to drift metrics table if using database
        if self.use_database and round_num is not None:
            self._log_drift_to_database(session_id, drift_metrics, round_num)
        
        return self.log_entry(
            session_id=session_id,
            entry_type="drift",
            data=data,
            metadata={"action": "log_drift"}
        )
    
    def log_performance_metrics(self, 
                               session_id: str, 
                               performance_metrics: Dict[str, Any], 
                               round_num: int = None) -> str:
        """
        Log performance metrics.
        
        Args:
            session_id: Session identifier
            performance_metrics: Performance data
            round_num: Round number (optional)
            
        Returns:
            Entry ID
        """
        data = {
            "performance_metrics": performance_metrics
        }
        
        if round_num is not None:
            data["round_num"] = round_num
        
        # Also log to performance metrics table if using database
        if self.use_database and round_num is not None:
            self._log_performance_to_database(session_id, performance_metrics, round_num)
        
        return self.log_entry(
            session_id=session_id,
            entry_type="performance",
            data=data,
            metadata={"action": "log_performance"}
        )
    
    def _log_drift_to_database(self, session_id: str, drift_metrics: Dict[str, Any], round_num: int):
        """Log drift metrics to database table"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        metric_id = f"{session_id}_drift_{round_num}_{int(time.time())}"
        
        cursor.execute('''
            INSERT INTO drift_metrics 
            (metric_id, session_id, round_number, prompt_hash, semantic_distance, 
             token_variation, argument_structure_drift, evidence_consistency, 
             overall_drift_score, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            metric_id,
            session_id,
            round_num,
            drift_metrics.get("prompt_hash", ""),
            drift_metrics.get("semantic_distance", 0.0),
            drift_metrics.get("token_variation", 0.0),
            drift_metrics.get("argument_structure_drift", 0.0),
            drift_metrics.get("evidence_consistency", 0.0),
            drift_metrics.get("overall_drift_score", 0.0),
            datetime.now().isoformat()
        ))
        
        conn.commit()
        conn.close()
    
    def _log_performance_to_database(self, session_id: str, performance_metrics: Dict[str, Any], round_num: int):
        """Log performance metrics to database table"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        metric_id = f"{session_id}_perf_{round_num}_{int(time.time())}"
        
        cursor.execute('''
            INSERT INTO performance_metrics 
            (metric_id, session_id, round_number, response_time, memory_usage, 
             token_count, model_name, timestamp)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            metric_id,
            session_id,
            round_num,
            performance_metrics.get("response_time", 0.0),
            performance_metrics.get("memory_usage", 0.0),
            performance_metrics.get("token_count", 0),
            performance_metrics.get("model_name", ""),
            datetime.now().isoformat()
        ))
        
        conn.commit()
        conn.close()
    
    def complete_session(self, session_id: str, performance_summary: Dict[str, Any] = None):
        """
        Mark a session as completed.
        
        Args:
            session_id: Session identifier
            performance_summary: Final performance summary
        """
        if session_id in self.active_sessions:
            session = self.active_sessions[session_id]
            session.end_time = datetime.now().isoformat()
            session.status = "completed"
            session.performance_summary = performance_summary
            
            # Update database
            if self.use_database:
                conn = sqlite3.connect(self.db_path)
                cursor = conn.cursor()
                
                cursor.execute('''
                    UPDATE debate_sessions 
                    SET end_time = ?, status = ?, performance_summary = ?
                    WHERE session_id = ?
                ''', (
                    session.end_time,
                    session.status,
                    json.dumps(performance_summary) if performance_summary else None,
                    session_id
                ))
                
                conn.commit()
                conn.close()
            
            # Log session completion
            self.log_entry(
                session_id=session_id,
                entry_type="session_completed",
                data={
                    "end_time": session.end_time,
                    "performance_summary": performance_summary
                },
                metadata={"action": "complete_session"}
            )
            
            logger.info(f"Completed logging session: {session_id}")
    
    def get_session_logs(self, session_id: str) -> List[Dict[str, Any]]:
        """
        Retrieve all logs for a specific session.
        
        Args:
            session_id: Session identifier
            
        Returns:
            List of log entries
        """
        if self.use_database:
            return self._get_session_logs_from_database(session_id)
        else:
            return self._get_session_logs_from_json(session_id)
    
    def _get_session_logs_from_database(self, session_id: str) -> List[Dict[str, Any]]:
        """Retrieve session logs from database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT entry_id, timestamp, entry_type, data, metadata
            FROM log_entries
            WHERE session_id = ?
            ORDER BY timestamp
        ''', (session_id,))
        
        rows = cursor.fetchall()
        conn.close()
        
        logs = []
        for row in rows:
            logs.append({
                "entry_id": row[0],
                "timestamp": row[1],
                "entry_type": row[2],
                "data": json.loads(row[3]),
                "metadata": json.loads(row[4]) if row[4] else None
            })
        
        return logs
    
    def _get_session_logs_from_json(self, session_id: str) -> List[Dict[str, Any]]:
        """Retrieve session logs from JSON file"""
        session_log_file = self.json_log_dir / f"session_{session_id}.json"
        
        if session_log_file.exists():
            with open(session_log_file, 'r') as f:
                return json.load(f)
        else:
            return []
    
    def get_drift_analysis(self, session_id: str) -> List[Dict[str, Any]]:
        """
        Get drift analysis data for a session.
        
        Args:
            session_id: Session identifier
            
        Returns:
            List of drift metrics
        """
        if not self.use_database:
            return []
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT round_number, semantic_distance, token_variation, 
                   argument_structure_drift, evidence_consistency, overall_drift_score, timestamp
            FROM drift_metrics
            WHERE session_id = ?
            ORDER BY round_number
        ''', (session_id,))
        
        rows = cursor.fetchall()
        conn.close()
        
        drift_data = []
        for row in rows:
            drift_data.append({
                "round_number": row[0],
                "semantic_distance": row[1],
                "token_variation": row[2],
                "argument_structure_drift": row[3],
                "evidence_consistency": row[4],
                "overall_drift_score": row[5],
                "timestamp": row[6]
            })
        
        return drift_data
    
    def get_performance_analysis(self, session_id: str) -> List[Dict[str, Any]]:
        """
        Get performance analysis data for a session.
        
        Args:
            session_id: Session identifier
            
        Returns:
            List of performance metrics
        """
        if not self.use_database:
            return []
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            SELECT round_number, response_time, memory_usage, token_count, model_name, timestamp
            FROM performance_metrics
            WHERE session_id = ?
            ORDER BY round_number
        ''', (session_id,))
        
        rows = cursor.fetchall()
        conn.close()
        
        performance_data = []
        for row in rows:
            performance_data.append({
                "round_number": row[0],
                "response_time": row[1],
                "memory_usage": row[2],
                "token_count": row[3],
                "model_name": row[4],
                "timestamp": row[5]
            })
        
        return performance_data
    
    def export_session_data(self, session_id: str, export_dir: str = None) -> str:
        """
        Export all data for a session to a comprehensive JSON file.
        
        Args:
            session_id: Session identifier
            export_dir: Directory to export to (optional)
            
        Returns:
            Path to exported file
        """
        if export_dir is None:
            export_dir = self.log_dir / "exports"
        
        export_path = Path(export_dir)
        export_path.mkdir(exist_ok=True)
        
        # Gather all session data
        session_data = {
            "session_id": session_id,
            "export_timestamp": datetime.now().isoformat(),
            "logs": self.get_session_logs(session_id),
            "drift_analysis": self.get_drift_analysis(session_id),
            "performance_analysis": self.get_performance_analysis(session_id)
        }
        
        # Add session info if available
        if session_id in self.active_sessions:
            session_data["session_info"] = asdict(self.active_sessions[session_id])
        
        # Export to file
        export_file = export_path / f"session_{session_id}_export.json"
        with open(export_file, 'w') as f:
            json.dump(session_data, f, indent=2)
        
        logger.info(f"Exported session data to: {export_file}")
        return str(export_file)
    
    def _generate_entry_id(self, session_id: str, entry_type: str) -> str:
        """Generate a unique entry ID"""
        timestamp = int(time.time() * 1000)  # Millisecond precision
        return f"{session_id}_{entry_type}_{timestamp}"
    
    def print_session_summary(self, session_id: str):
        """Print a summary of session logging data"""
        if session_id not in self.active_sessions:
            print(f"No active session found: {session_id}")
            return
        
        session = self.active_sessions[session_id]
        logs = self.get_session_logs(session_id)
        drift_data = self.get_drift_analysis(session_id)
        performance_data = self.get_performance_analysis(session_id)
        
        print(f"\n{'='*60}")
        print(f"SESSION LOGGING SUMMARY: {session_id}")
        print(f"{'='*60}")
        
        print(f"Topic: {session.topic}")
        print(f"Status: {session.status}")
        print(f"Start Time: {session.start_time}")
        if session.end_time:
            print(f"End Time: {session.end_time}")
        
        print(f"\nLog Entries: {len(logs)}")
        entry_types = {}
        for log in logs:
            entry_type = log['entry_type']
            entry_types[entry_type] = entry_types.get(entry_type, 0) + 1
        
        for entry_type, count in entry_types.items():
            print(f"  {entry_type}: {count}")
        
        print(f"\nDrift Analysis Points: {len(drift_data)}")
        if drift_data:
            avg_drift = sum(d['overall_drift_score'] for d in drift_data) / len(drift_data)
            print(f"  Average Drift Score: {avg_drift:.3f}")
        
        print(f"\nPerformance Data Points: {len(performance_data)}")
        if performance_data:
            avg_response_time = sum(d['response_time'] for d in performance_data) / len(performance_data)
            print(f"  Average Response Time: {avg_response_time:.2f}s")
        
        print("="*60)

# Example usage and testing
if __name__ == "__main__":
    # Initialize auto-logger
    logger_system = AutoLogger()
    
    # Create a session
    session_id = "test_session_001"
    game_id = "test_game_001"
    topic = "H.R. 40 - Reparations Study Commission"
    model_configs = {
        "pro_model": "openai/gpt-4o-mini",
        "con_model": "openai/gpt-4o-mini",
        "judge_model": "openai/gpt-4o-mini"
    }
    
    session = logger_system.create_session(session_id, game_id, topic, model_configs)
    
    # Simulate some logging
    print("Simulating debate logging...")
    
    # Log inputs and outputs for a few rounds
    for round_num in range(1, 4):
        # Log input
        prompt = f"Round {round_num} prompt for {topic}"
        logger_system.log_input(session_id, prompt, "openai/gpt-4o-mini", round_num)
        
        # Log output
        response = f"Round {round_num} response with arguments and evidence"
        logger_system.log_output(session_id, response, "openai/gpt-4o-mini", 15.5, round_num)
        
        # Log drift metrics
        drift_metrics = {
            "semantic_distance": 0.1 + (round_num * 0.05),
            "token_variation": 0.2 + (round_num * 0.03),
            "overall_drift_score": 0.15 + (round_num * 0.02)
        }
        logger_system.log_drift_metrics(session_id, drift_metrics, round_num)
        
        # Log performance metrics
        performance_metrics = {
            "response_time": 15.0 + (round_num * 2.0),
            "memory_usage": 50.0 + (round_num * 5.0),
            "token_count": 200 + (round_num * 50),
            "model_name": "openai/gpt-4o-mini"
        }
        logger_system.log_performance_metrics(session_id, performance_metrics, round_num)
    
    # Wait for logging to complete
    time.sleep(2)
    
    # Complete session
    performance_summary = {
        "total_rounds": 3,
        "avg_response_time": 19.0,
        "total_memory_used": 180.0,
        "avg_drift_score": 0.21
    }
    logger_system.complete_session(session_id, performance_summary)
    
    # Print summary
    logger_system.print_session_summary(session_id)
    
    # Export session data
    export_file = logger_system.export_session_data(session_id)
    print(f"\nSession data exported to: {export_file}")
    
    # Stop logging system
    logger_system.stop_logging()
