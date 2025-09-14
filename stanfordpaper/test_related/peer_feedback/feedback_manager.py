#!/usr/bin/env python3
"""
Peer Feedback Management System
Manages the peer review process for the AI Debate Model & Drift Analysis research
"""

import json
import datetime
from pathlib import Path
from typing import Dict, List, Optional, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import logging

# Set up logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

class ReviewStatus(Enum):
    """Review status enumeration"""
    INVITED = "invited"
    IN_PROGRESS = "in_progress"
    COMPLETED = "completed"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"

class ReviewCategory(Enum):
    """Review category enumeration"""
    TECHNICAL = "technical"
    DOMAIN_EXPERT = "domain_expert"
    METHODOLOGY = "methodology"
    ETHICS = "ethics"
    PRESENTATION = "presentation"

class FeedbackPriority(Enum):
    """Feedback priority enumeration"""
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"

@dataclass
class Reviewer:
    """Reviewer information"""
    id: str
    name: str
    email: str
    institution: str
    expertise_areas: List[str]
    review_categories: List[ReviewCategory]
    availability: str
    notes: Optional[str] = None

@dataclass
class ReviewRequest:
    """Review request information"""
    id: str
    reviewer_id: str
    review_category: ReviewCategory
    materials: List[str]
    deadline: datetime.datetime
    status: ReviewStatus
    invitation_date: datetime.datetime
    notes: Optional[str] = None

@dataclass
class Feedback:
    """Feedback item"""
    id: str
    review_request_id: str
    category: str
    priority: FeedbackPriority
    title: str
    description: str
    suggestions: List[str]
    status: str  # "pending", "addressed", "rejected"
    response: Optional[str] = None
    created_date: datetime.datetime = None
    updated_date: datetime.datetime = None

@dataclass
class ReviewSession:
    """Review session information"""
    id: str
    title: str
    description: str
    start_date: datetime.datetime
    end_date: datetime.datetime
    reviewers: List[str]
    materials: List[str]
    status: str  # "planned", "active", "completed"
    notes: Optional[str] = None

class FeedbackManager:
    """Manages the peer feedback process"""
    
    def __init__(self, data_dir: str = "peer_feedback_data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(exist_ok=True)
        
        # Initialize data structures
        self.reviewers: Dict[str, Reviewer] = {}
        self.review_requests: Dict[str, ReviewRequest] = {}
        self.feedback_items: Dict[str, Feedback] = {}
        self.review_sessions: Dict[str, ReviewSession] = {}
        
        # Load existing data
        self.load_data()
        
    def load_data(self) -> None:
        """Load existing data from files"""
        try:
            # Load reviewers
            reviewers_file = self.data_dir / "reviewers.json"
            if reviewers_file.exists():
                with open(reviewers_file, 'r') as f:
                    reviewers_data = json.load(f)
                    for reviewer_id, data in reviewers_data.items():
                        data['review_categories'] = [ReviewCategory(cat) for cat in data['review_categories']]
                        self.reviewers[reviewer_id] = Reviewer(**data)
            
            # Load review requests
            requests_file = self.data_dir / "review_requests.json"
            if requests_file.exists():
                with open(requests_file, 'r') as f:
                    requests_data = json.load(f)
                    for request_id, data in requests_data.items():
                        data['review_category'] = ReviewCategory(data['review_category'])
                        data['status'] = ReviewStatus(data['status'])
                        data['deadline'] = datetime.datetime.fromisoformat(data['deadline'])
                        data['invitation_date'] = datetime.datetime.fromisoformat(data['invitation_date'])
                        self.review_requests[request_id] = ReviewRequest(**data)
            
            # Load feedback items
            feedback_file = self.data_dir / "feedback_items.json"
            if feedback_file.exists():
                with open(feedback_file, 'r') as f:
                    feedback_data = json.load(f)
                    for feedback_id, data in feedback_data.items():
                        data['priority'] = FeedbackPriority(data['priority'])
                        if data['created_date']:
                            data['created_date'] = datetime.datetime.fromisoformat(data['created_date'])
                        if data['updated_date']:
                            data['updated_date'] = datetime.datetime.fromisoformat(data['updated_date'])
                        self.feedback_items[feedback_id] = Feedback(**data)
            
            # Load review sessions
            sessions_file = self.data_dir / "review_sessions.json"
            if sessions_file.exists():
                with open(sessions_file, 'r') as f:
                    sessions_data = json.load(f)
                    for session_id, data in sessions_data.items():
                        data['start_date'] = datetime.datetime.fromisoformat(data['start_date'])
                        data['end_date'] = datetime.datetime.fromisoformat(data['end_date'])
                        self.review_sessions[session_id] = ReviewSession(**data)
                        
            logger.info(f"Loaded data: {len(self.reviewers)} reviewers, {len(self.review_requests)} requests, {len(self.feedback_items)} feedback items, {len(self.review_sessions)} sessions")
            
        except Exception as e:
            logger.error(f"Error loading data: {e}")
    
    def save_data(self) -> None:
        """Save data to files"""
        try:
            # Save reviewers
            reviewers_data = {}
            for reviewer_id, reviewer in self.reviewers.items():
                data = asdict(reviewer)
                data['review_categories'] = [cat.value for cat in data['review_categories']]
                reviewers_data[reviewer_id] = data
            
            with open(self.data_dir / "reviewers.json", 'w') as f:
                json.dump(reviewers_data, f, indent=2, default=str)
            
            # Save review requests
            requests_data = {}
            for request_id, request in self.review_requests.items():
                data = asdict(request)
                data['review_category'] = data['review_category'].value
                data['status'] = data['status'].value
                data['deadline'] = data['deadline'].isoformat()
                data['invitation_date'] = data['invitation_date'].isoformat()
                requests_data[request_id] = data
            
            with open(self.data_dir / "review_requests.json", 'w') as f:
                json.dump(requests_data, f, indent=2, default=str)
            
            # Save feedback items
            feedback_data = {}
            for feedback_id, feedback in self.feedback_items.items():
                data = asdict(feedback)
                data['priority'] = data['priority'].value
                if data['created_date']:
                    data['created_date'] = data['created_date'].isoformat()
                if data['updated_date']:
                    data['updated_date'] = data['updated_date'].isoformat()
                feedback_data[feedback_id] = data
            
            with open(self.data_dir / "feedback_items.json", 'w') as f:
                json.dump(feedback_data, f, indent=2, default=str)
            
            # Save review sessions
            sessions_data = {}
            for session_id, session in self.review_sessions.items():
                data = asdict(session)
                data['start_date'] = data['start_date'].isoformat()
                data['end_date'] = data['end_date'].isoformat()
                sessions_data[session_id] = data
            
            with open(self.data_dir / "review_sessions.json", 'w') as f:
                json.dump(sessions_data, f, indent=2, default=str)
                
            logger.info("Data saved successfully")
            
        except Exception as e:
            logger.error(f"Error saving data: {e}")
    
    def add_reviewer(self, reviewer: Reviewer) -> None:
        """Add a new reviewer"""
        self.reviewers[reviewer.id] = reviewer
        self.save_data()
        logger.info(f"Added reviewer: {reviewer.name}")
    
    def create_review_request(self, reviewer_id: str, review_category: ReviewCategory, 
                            materials: List[str], deadline: datetime.datetime) -> str:
        """Create a new review request"""
        request_id = f"req_{len(self.review_requests) + 1:03d}"
        request = ReviewRequest(
            id=request_id,
            reviewer_id=reviewer_id,
            review_category=review_category,
            materials=materials,
            deadline=deadline,
            status=ReviewStatus.INVITED,
            invitation_date=datetime.datetime.now()
        )
        self.review_requests[request_id] = request
        self.save_data()
        logger.info(f"Created review request: {request_id}")
        return request_id
    
    def add_feedback(self, review_request_id: str, category: str, priority: FeedbackPriority,
                    title: str, description: str, suggestions: List[str]) -> str:
        """Add a new feedback item"""
        feedback_id = f"fb_{len(self.feedback_items) + 1:03d}"
        feedback = Feedback(
            id=feedback_id,
            review_request_id=review_request_id,
            category=category,
            priority=priority,
            title=title,
            description=description,
            suggestions=suggestions,
            status="pending",
            created_date=datetime.datetime.now()
        )
        self.feedback_items[feedback_id] = feedback
        self.save_data()
        logger.info(f"Added feedback: {feedback_id}")
        return feedback_id
    
    def update_feedback_status(self, feedback_id: str, status: str, response: Optional[str] = None) -> None:
        """Update feedback status"""
        if feedback_id in self.feedback_items:
            self.feedback_items[feedback_id].status = status
            self.feedback_items[feedback_id].response = response
            self.feedback_items[feedback_id].updated_date = datetime.datetime.now()
            self.save_data()
            logger.info(f"Updated feedback {feedback_id} status to {status}")
    
    def create_review_session(self, title: str, description: str, start_date: datetime.datetime,
                            end_date: datetime.datetime, reviewers: List[str], materials: List[str]) -> str:
        """Create a new review session"""
        session_id = f"session_{len(self.review_sessions) + 1:03d}"
        session = ReviewSession(
            id=session_id,
            title=title,
            description=description,
            start_date=start_date,
            end_date=end_date,
            reviewers=reviewers,
            materials=materials,
            status="planned"
        )
        self.review_sessions[session_id] = session
        self.save_data()
        logger.info(f"Created review session: {session_id}")
        return session_id
    
    def get_reviewer_by_category(self, category: ReviewCategory) -> List[Reviewer]:
        """Get reviewers by category"""
        return [reviewer for reviewer in self.reviewers.values() 
                if category in reviewer.review_categories]
    
    def get_feedback_by_priority(self, priority: FeedbackPriority) -> List[Feedback]:
        """Get feedback items by priority"""
        return [feedback for feedback in self.feedback_items.values() 
                if feedback.priority == priority]
    
    def get_overdue_reviews(self) -> List[ReviewRequest]:
        """Get overdue review requests"""
        now = datetime.datetime.now()
        return [request for request in self.review_requests.values() 
                if request.deadline < now and request.status == ReviewStatus.IN_PROGRESS]
    
    def generate_review_report(self) -> Dict:
        """Generate a comprehensive review report"""
        report = {
            "summary": {
                "total_reviewers": len(self.reviewers),
                "total_requests": len(self.review_requests),
                "total_feedback": len(self.feedback_items),
                "total_sessions": len(self.review_sessions)
            },
            "review_status": {
                "invited": len([r for r in self.review_requests.values() if r.status == ReviewStatus.INVITED]),
                "in_progress": len([r for r in self.review_requests.values() if r.status == ReviewStatus.IN_PROGRESS]),
                "completed": len([r for r in self.review_requests.values() if r.status == ReviewStatus.COMPLETED]),
                "overdue": len(self.get_overdue_reviews())
            },
            "feedback_status": {
                "pending": len([f for f in self.feedback_items.values() if f.status == "pending"]),
                "addressed": len([f for f in self.feedback_items.values() if f.status == "addressed"]),
                "rejected": len([f for f in self.feedback_items.values() if f.status == "rejected"])
            },
            "feedback_priority": {
                "critical": len(self.get_feedback_by_priority(FeedbackPriority.CRITICAL)),
                "high": len(self.get_feedback_by_priority(FeedbackPriority.HIGH)),
                "medium": len(self.get_feedback_by_priority(FeedbackPriority.MEDIUM)),
                "low": len(self.get_feedback_by_priority(FeedbackPriority.LOW))
            }
        }
        return report
    
    def export_review_data(self, output_file: str) -> None:
        """Export review data to a file"""
        export_data = {
            "reviewers": {k: asdict(v) for k, v in self.reviewers.items()},
            "review_requests": {k: asdict(v) for k, v in self.review_requests.items()},
            "feedback_items": {k: asdict(v) for k, v in self.feedback_items.items()},
            "review_sessions": {k: asdict(v) for k, v in self.review_sessions.items()},
            "report": self.generate_review_report()
        }
        
        with open(output_file, 'w') as f:
            json.dump(export_data, f, indent=2, default=str)
        
        logger.info(f"Exported review data to {output_file}")

def main():
    """Main function to demonstrate the feedback manager"""
    manager = FeedbackManager()
    
    # Add sample reviewers
    reviewer1 = Reviewer(
        id="rev_001",
        name="Dr. Jane Smith",
        email="jane.smith@university.edu",
        institution="University of AI Research",
        expertise_areas=["Large Language Models", "Prompt Engineering", "AI Evaluation"],
        review_categories=[ReviewCategory.TECHNICAL, ReviewCategory.METHODOLOGY],
        availability="Available for 2-week review periods"
    )
    
    reviewer2 = Reviewer(
        id="rev_002",
        name="Dr. John Doe",
        email="john.doe@policy.org",
        institution="Policy Research Institute",
        expertise_areas=["Legislative Analysis", "Democratic Processes", "Civic Engagement"],
        review_categories=[ReviewCategory.DOMAIN_EXPERT, ReviewCategory.ETHICS],
        availability="Available for 1-week review periods"
    )
    
    manager.add_reviewer(reviewer1)
    manager.add_reviewer(reviewer2)
    
    # Create review requests
    deadline = datetime.datetime.now() + datetime.timedelta(weeks=2)
    request1 = manager.create_review_request(
        reviewer_id="rev_001",
        review_category=ReviewCategory.TECHNICAL,
        materials=["research_proposal.pdf", "draft_manuscript.pdf", "code_repository"],
        deadline=deadline
    )
    
    request2 = manager.create_review_request(
        reviewer_id="rev_002",
        review_category=ReviewCategory.DOMAIN_EXPERT,
        materials=["research_proposal.pdf", "draft_manuscript.pdf"],
        deadline=deadline
    )
    
    # Add sample feedback
    feedback1 = manager.add_feedback(
        review_request_id=request1,
        category="Methodology",
        priority=FeedbackPriority.HIGH,
        title="Statistical Analysis Concerns",
        description="The statistical analysis needs more robust validation methods",
        suggestions=["Add bootstrap confidence intervals", "Include sensitivity analysis", "Validate assumptions"]
    )
    
    feedback2 = manager.add_feedback(
        review_request_id=request2,
        category="Content",
        priority=FeedbackPriority.MEDIUM,
        title="Legislative Context",
        description="The legislative context could be better explained",
        suggestions=["Add more background on H.R. 40 and H.R. 1", "Explain legislative process", "Include stakeholder perspectives"]
    )
    
    # Generate report
    report = manager.generate_review_report()
    print("Review Report:")
    print(json.dumps(report, indent=2))
    
    # Export data
    manager.export_review_data("review_data_export.json")

if __name__ == "__main__":
    main()
