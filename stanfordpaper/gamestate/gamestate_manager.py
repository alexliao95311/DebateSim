"""
Gamestate Management System for AI Debate Models

This module implements a gamestate file system that represents the setup for the debate model
to receive prompts and maintain context. It tracks the "state of the game" including debate
and judge setup, and integrates with the existing DebateSim system.
"""

import json
import os
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional, Union
from dataclasses import dataclass, asdict
from enum import Enum
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class DebateFormat(Enum):
    """Enumeration of supported debate formats"""
    STANDARD = "standard"  # 5-round format
    PUBLIC_FORUM = "public_forum"  # 4-round format
    POLICY = "policy"  # Policy debate format
    LINCOLN_DOUGLAS = "lincoln_douglas"  # LD format

class DebateStatus(Enum):
    """Enumeration of debate status states"""
    INITIALIZING = "initializing"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    PAUSED = "paused"
    ERROR = "error"

@dataclass
class DebaterConfig:
    """Configuration for a debater agent"""
    role: str  # "pro" or "con"
    persona: str  # Persona name (e.g., "Donald Trump", "Kamala Harris")
    model: str  # AI model to use
    temperature: float = 0.7
    max_tokens: Optional[int] = None
    custom_instructions: Optional[str] = None

@dataclass
class JudgeConfig:
    """Configuration for the judge agent"""
    model: str  # AI model to use
    temperature: float = 0.5
    evaluation_criteria: List[str] = None
    custom_instructions: Optional[str] = None

@dataclass
class DebateTopic:
    """Configuration for the debate topic"""
    title: str
    description: str
    bill_text: Optional[str] = None
    bill_id: Optional[str] = None
    evidence_requirements: List[str] = None
    time_limits: Dict[str, int] = None  # Time limits per round

@dataclass
class RoundState:
    """State of a single debate round"""
    round_number: int
    speaker: str  # "pro" or "con"
    speech_type: str  # "constructive", "rebuttal", "summary", "final_focus"
    prompt: str
    response: Optional[str] = None
    response_time: Optional[float] = None
    timestamp: Optional[str] = None
    metrics: Optional[Dict[str, Any]] = None

@dataclass
class Gamestate:
    """
    Main gamestate container that tracks the complete state of a debate session.
    
    This represents the setup for the debate model to receive prompts and maintain context.
    """
    # Core identifiers
    game_id: str
    session_id: str
    
    # Debate configuration
    debate_format: DebateFormat
    debate_status: DebateStatus
    topic: DebateTopic
    debater_configs: Dict[str, DebaterConfig]  # "pro" and "con" keys
    judge_config: JudgeConfig
    
    # Debate state
    current_round: int
    current_speaker: str
    speaking_order: List[str]  # Order of speakers
    rounds: List[RoundState]
    
    # Context and memory
    full_transcript: str
    context_memory: Dict[str, Any]
    
    # Metadata
    created_at: str
    updated_at: str
    created_by: Optional[str] = None
    
    # Performance tracking
    performance_metrics: Dict[str, Any] = None
    drift_metrics: Dict[str, Any] = None

class GamestateManager:
    """
    Manager class for handling gamestate files and operations.
    
    This class provides methods to create, update, save, and load gamestate files,
    and integrates with the existing DebateSim system.
    """
    
    def __init__(self, gamestate_dir: str = "gamestates"):
        """
        Initialize the gamestate manager.
        
        Args:
            gamestate_dir: Directory to store gamestate files
        """
        self.gamestate_dir = gamestate_dir
        self.current_gamestate: Optional[Gamestate] = None
        
        # Ensure gamestate directory exists
        os.makedirs(gamestate_dir, exist_ok=True)
        
        # Create subdirectories for organization
        os.makedirs(os.path.join(gamestate_dir, "active"), exist_ok=True)
        os.makedirs(os.path.join(gamestate_dir, "completed"), exist_ok=True)
        os.makedirs(os.path.join(gamestate_dir, "archived"), exist_ok=True)
    
    def create_gamestate(self, 
                        topic: DebateTopic,
                        debate_format: DebateFormat = DebateFormat.STANDARD,
                        pro_config: DebaterConfig = None,
                        con_config: DebaterConfig = None,
                        judge_config: JudgeConfig = None,
                        created_by: str = None) -> Gamestate:
        """
        Create a new gamestate for a debate session.
        
        Args:
            topic: The debate topic configuration
            debate_format: The format of the debate
            pro_config: Configuration for the Pro debater
            con_config: Configuration for the Con debater
            judge_config: Configuration for the judge
            created_by: User who created the gamestate
            
        Returns:
            New Gamestate object
        """
        # Generate unique identifiers
        game_id = str(uuid.uuid4())
        session_id = f"session_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
        
        # Set default configurations if not provided
        if pro_config is None:
            pro_config = DebaterConfig(
                role="pro",
                persona="Default AI",
                model="openai/gpt-4o-mini"
            )
        
        if con_config is None:
            con_config = DebaterConfig(
                role="con",
                persona="Default AI",
                model="openai/gpt-4o-mini"
            )
        
        if judge_config is None:
            judge_config = JudgeConfig(
                model="openai/gpt-4o-mini",
                evaluation_criteria=[
                    "Argument quality",
                    "Evidence usage",
                    "Rebuttal effectiveness",
                    "Overall persuasiveness"
                ]
            )
        
        # Determine speaking order based on format
        if debate_format == DebateFormat.PUBLIC_FORUM:
            speaking_order = ["pro", "con", "pro", "con", "pro", "con", "pro", "con"]
        else:  # Standard format
            speaking_order = ["pro", "con", "pro", "con", "pro"]
        
        # Create gamestate
        gamestate = Gamestate(
            game_id=game_id,
            session_id=session_id,
            debate_format=debate_format,
            debate_status=DebateStatus.INITIALIZING,
            topic=topic,
            debater_configs={
                "pro": pro_config,
                "con": con_config
            },
            judge_config=judge_config,
            current_round=0,
            current_speaker="pro",
            speaking_order=speaking_order,
            rounds=[],
            full_transcript="",
            context_memory={},
            created_at=datetime.now().isoformat(),
            updated_at=datetime.now().isoformat(),
            created_by=created_by
        )
        
        # Set as current gamestate
        self.current_gamestate = gamestate
        
        logger.info(f"Created new gamestate: {game_id}")
        return gamestate
    
    def update_gamestate(self, 
                        round_data: Dict[str, Any],
                        response: str = None,
                        response_time: float = None,
                        metrics: Dict[str, Any] = None) -> bool:
        """
        Update the current gamestate with new round data.
        
        Args:
            round_data: Data about the current round
            response: Model response (optional)
            response_time: Time taken to generate response (optional)
            metrics: Performance metrics (optional)
            
        Returns:
            True if update was successful
        """
        if not self.current_gamestate:
            logger.error("No current gamestate to update")
            return False
        
        # Create round state
        round_state = RoundState(
            round_number=round_data.get('round_num', self.current_gamestate.current_round + 1),
            speaker=round_data.get('debater', self.current_gamestate.current_speaker),
            speech_type=round_data.get('speech_type', 'constructive'),
            prompt=round_data.get('prompt', ''),
            response=response,
            response_time=response_time,
            timestamp=datetime.now().isoformat(),
            metrics=metrics
        )
        
        # Add round to gamestate
        self.current_gamestate.rounds.append(round_state)
        
        # Update gamestate state
        self.current_gamestate.current_round = round_state.round_number
        
        # Update transcript
        if response:
            transcript_entry = f"[Round {round_state.round_number}][{round_state.speaker.upper()}] {response}\n\n"
            self.current_gamestate.full_transcript += transcript_entry
        
        # Update context memory
        self.current_gamestate.context_memory[f"round_{round_state.round_number}"] = {
            "speaker": round_state.speaker,
            "response": response,
            "timestamp": round_state.timestamp
        }
        
        # Update timestamp
        self.current_gamestate.updated_at = datetime.now().isoformat()
        
        # Update status
        if self.current_gamestate.debate_status == DebateStatus.INITIALIZING:
            self.current_gamestate.debate_status = DebateStatus.IN_PROGRESS
        
        logger.info(f"Updated gamestate: Round {round_state.round_number}")
        return True
    
    def get_next_speaker(self) -> Optional[str]:
        """
        Get the next speaker in the debate.
        
        Returns:
            Next speaker role ("pro" or "con") or None if debate is complete
        """
        if not self.current_gamestate:
            return None
        
        # Check if debate is complete
        max_rounds = len(self.current_gamestate.speaking_order)
        if self.current_gamestate.current_round >= max_rounds:
            return None
        
        # Get next speaker from speaking order
        next_speaker = self.current_gamestate.speaking_order[self.current_gamestate.current_round]
        self.current_gamestate.current_speaker = next_speaker
        
        return next_speaker
    
    def get_round_prompt_data(self, round_num: int = None) -> Dict[str, Any]:
        """
        Get prompt data for the current or specified round.
        
        Args:
            round_num: Specific round number (optional)
            
        Returns:
            Dictionary containing prompt data
        """
        if not self.current_gamestate:
            return {}
        
        if round_num is None:
            round_num = self.current_gamestate.current_round + 1
        
        # Get current speaker
        speaker = self.get_next_speaker()
        if not speaker:
            return {}
        
        # Get debater config
        debater_config = self.current_gamestate.debater_configs.get(speaker)
        if not debater_config:
            return {}
        
        # Determine speech type based on format and round
        speech_type = self._get_speech_type(round_num, speaker)
        
        # Build prompt data
        prompt_data = {
            "debater": speaker,
            "prompt": self.current_gamestate.topic.title,
            "model": debater_config.model,
            "bill_description": self.current_gamestate.topic.bill_text or self.current_gamestate.topic.description,
            "full_transcript": self.current_gamestate.full_transcript,
            "round_num": round_num,
            "persona": debater_config.persona,
            "debate_format": self.current_gamestate.debate_format.value,
            "speech_type": speech_type,
            "temperature": debater_config.temperature,
            "custom_instructions": debater_config.custom_instructions
        }
        
        return prompt_data
    
    def _get_speech_type(self, round_num: int, speaker: str) -> str:
        """Determine the speech type for a given round and speaker"""
        if self.current_gamestate.debate_format == DebateFormat.PUBLIC_FORUM:
            if round_num == 1:
                return "constructive"
            elif round_num == 2:
                return "rebuttal"
            elif round_num == 3:
                return "summary"
            elif round_num == 4:
                return "final_focus"
        else:  # Standard format
            if round_num == 1 and speaker == "pro":
                return "constructive"
            elif round_num == 1 and speaker == "con":
                return "constructive_rebuttal"
            else:
                return "rebuttal"
        
        return "constructive"
    
    def save_gamestate(self, filename: str = None) -> str:
        """
        Save the current gamestate to a JSON file.
        
        Args:
            filename: Optional filename, defaults to game_id.json
            
        Returns:
            Path to saved file
        """
        if not self.current_gamestate:
            raise ValueError("No current gamestate to save")
        
        if filename is None:
            filename = f"{self.current_gamestate.game_id}.json"
        
        # Determine directory based on status
        if self.current_gamestate.debate_status == DebateStatus.COMPLETED:
            save_dir = os.path.join(self.gamestate_dir, "completed")
        elif self.current_gamestate.debate_status == DebateStatus.IN_PROGRESS:
            save_dir = os.path.join(self.gamestate_dir, "active")
        else:
            save_dir = os.path.join(self.gamestate_dir, "archived")
        
        filepath = os.path.join(save_dir, filename)
        
        # Convert gamestate to dictionary
        gamestate_dict = self._gamestate_to_dict(self.current_gamestate)
        
        # Save to file
        with open(filepath, 'w') as f:
            json.dump(gamestate_dict, f, indent=2)
        
        logger.info(f"Gamestate saved to: {filepath}")
        return filepath
    
    def load_gamestate(self, filepath: str) -> Gamestate:
        """
        Load a gamestate from a JSON file.
        
        Args:
            filepath: Path to the gamestate file
            
        Returns:
            Loaded Gamestate object
        """
        with open(filepath, 'r') as f:
            gamestate_dict = json.load(f)
        
        # Convert dictionary to gamestate
        gamestate = self._dict_to_gamestate(gamestate_dict)
        
        # Set as current gamestate
        self.current_gamestate = gamestate
        
        logger.info(f"Gamestate loaded from: {filepath}")
        return gamestate
    
    def _gamestate_to_dict(self, gamestate: Gamestate) -> Dict[str, Any]:
        """Convert Gamestate object to dictionary for JSON serialization"""
        gamestate_dict = asdict(gamestate)
        
        # Convert enums to strings
        gamestate_dict['debate_format'] = gamestate.debate_format.value
        gamestate_dict['debate_status'] = gamestate.debate_status.value
        
        # Convert debater configs
        for role, config in gamestate.debater_configs.items():
            gamestate_dict['debater_configs'][role] = asdict(config)
        
        # Convert judge config
        gamestate_dict['judge_config'] = asdict(gamestate.judge_config)
        
        # Convert topic
        gamestate_dict['topic'] = asdict(gamestate.topic)
        
        # Convert rounds
        gamestate_dict['rounds'] = [asdict(round_state) for round_state in gamestate.rounds]
        
        return gamestate_dict
    
    def _dict_to_gamestate(self, gamestate_dict: Dict[str, Any]) -> Gamestate:
        """Convert dictionary to Gamestate object"""
        # Convert enums
        gamestate_dict['debate_format'] = DebateFormat(gamestate_dict['debate_format'])
        gamestate_dict['debate_status'] = DebateStatus(gamestate_dict['debate_status'])
        
        # Convert topic
        topic_dict = gamestate_dict['topic']
        gamestate_dict['topic'] = DebateTopic(**topic_dict)
        
        # Convert debater configs
        debater_configs = {}
        for role, config_dict in gamestate_dict['debater_configs'].items():
            debater_configs[role] = DebaterConfig(**config_dict)
        gamestate_dict['debater_configs'] = debater_configs
        
        # Convert judge config
        judge_dict = gamestate_dict['judge_config']
        gamestate_dict['judge_config'] = JudgeConfig(**judge_dict)
        
        # Convert rounds
        rounds = []
        for round_dict in gamestate_dict['rounds']:
            rounds.append(RoundState(**round_dict))
        gamestate_dict['rounds'] = rounds
        
        return Gamestate(**gamestate_dict)
    
    def complete_debate(self, final_metrics: Dict[str, Any] = None) -> bool:
        """
        Mark the current debate as completed.
        
        Args:
            final_metrics: Final performance metrics
            
        Returns:
            True if completion was successful
        """
        if not self.current_gamestate:
            logger.error("No current gamestate to complete")
            return False
        
        # Update status
        self.current_gamestate.debate_status = DebateStatus.COMPLETED
        self.current_gamestate.updated_at = datetime.now().isoformat()
        
        # Add final metrics
        if final_metrics:
            self.current_gamestate.performance_metrics = final_metrics
        
        # Save to completed directory
        self.save_gamestate()
        
        logger.info(f"Debate completed: {self.current_gamestate.game_id}")
        return True
    
    def get_gamestate_summary(self) -> Dict[str, Any]:
        """
        Get a summary of the current gamestate.
        
        Returns:
            Dictionary containing gamestate summary
        """
        if not self.current_gamestate:
            return {"error": "No current gamestate"}
        
        return {
            "game_id": self.current_gamestate.game_id,
            "session_id": self.current_gamestate.session_id,
            "debate_format": self.current_gamestate.debate_format.value,
            "debate_status": self.current_gamestate.debate_status.value,
            "topic": self.current_gamestate.topic.title,
            "current_round": self.current_gamestate.current_round,
            "current_speaker": self.current_gamestate.current_speaker,
            "total_rounds": len(self.current_gamestate.rounds),
            "transcript_length": len(self.current_gamestate.full_transcript),
            "created_at": self.current_gamestate.created_at,
            "updated_at": self.current_gamestate.updated_at
        }
    
    def print_gamestate(self):
        """Print the current gamestate to the terminal"""
        if not self.current_gamestate:
            print("No current gamestate")
            return
        
        print("\n" + "="*60)
        print("CURRENT GAMESTATE")
        print("="*60)
        
        summary = self.get_gamestate_summary()
        for key, value in summary.items():
            print(f"{key.replace('_', ' ').title()}: {value}")
        
        print(f"\nDebater Configurations:")
        for role, config in self.current_gamestate.debater_configs.items():
            print(f"  {role.upper()}: {config.persona} ({config.model})")
        
        print(f"\nJudge Configuration:")
        print(f"  Model: {self.current_gamestate.judge_config.model}")
        
        print(f"\nRounds Completed: {len(self.current_gamestate.rounds)}")
        for i, round_state in enumerate(self.current_gamestate.rounds, 1):
            print(f"  Round {i}: {round_state.speaker.upper()} - {round_state.speech_type}")
            if round_state.response_time:
                print(f"    Response time: {round_state.response_time:.2f}s")
        
        print("="*60)

# Example usage and testing
if __name__ == "__main__":
    # Initialize gamestate manager
    manager = GamestateManager()
    
    # Create a debate topic
    topic = DebateTopic(
        title="H.R. 40 - Commission to Study and Develop Reparation Proposals for African-Americans Act",
        description="This bill establishes a commission to study and develop reparation proposals for African-Americans.",
        bill_text="[Bill text would go here]",
        bill_id="HR40-119",
        evidence_requirements=[
            "Direct quotes from bill text",
            "Historical context",
            "Economic impact data"
        ]
    )
    
    # Create debater configurations
    pro_config = DebaterConfig(
        role="pro",
        persona="Kamala Harris",
        model="openai/gpt-4o-mini",
        temperature=0.7,
        custom_instructions="Use precise legal language and focus on justice and equity."
    )
    
    con_config = DebaterConfig(
        role="con",
        persona="Donald Trump",
        model="openai/gpt-4o-mini",
        temperature=0.8,
        custom_instructions="Use direct, accessible language and focus on practical concerns."
    )
    
    # Create judge configuration
    judge_config = JudgeConfig(
        model="openai/gpt-4o-mini",
        temperature=0.5,
        evaluation_criteria=[
            "Argument quality and logic",
            "Evidence usage and accuracy",
            "Rebuttal effectiveness",
            "Overall persuasiveness"
        ]
    )
    
    # Create gamestate
    gamestate = manager.create_gamestate(
        topic=topic,
        debate_format=DebateFormat.STANDARD,
        pro_config=pro_config,
        con_config=con_config,
        judge_config=judge_config,
        created_by="test_user"
    )
    
    # Print initial gamestate
    manager.print_gamestate()
    
    # Simulate a round
    round_data = {
        "round_num": 1,
        "debater": "pro",
        "prompt": topic.title,
        "speech_type": "constructive"
    }
    
    # Update gamestate with round data
    manager.update_gamestate(
        round_data=round_data,
        response="### 1. Historical Justice\nThis bill addresses centuries of systemic discrimination...",
        response_time=15.3,
        metrics={"word_count": 150, "argument_count": 3}
    )
    
    # Print updated gamestate
    manager.print_gamestate()
    
    # Save gamestate
    filepath = manager.save_gamestate()
    print(f"\nGamestate saved to: {filepath}")
    
    # Get next speaker
    next_speaker = manager.get_next_speaker()
    print(f"\nNext speaker: {next_speaker}")
    
    # Get prompt data for next round
    prompt_data = manager.get_round_prompt_data()
    print(f"\nNext round prompt data: {json.dumps(prompt_data, indent=2)}")
