# DebateSim: AI-Powered Debate Simulation

DebateSim is an innovative website designed to simulate debate scenarios using artificial intelligence. This tool allows users to explore the dynamics of debates by enabling AI to take on roles such as debaters, judges, or both. Whether you’re a student, coach, or debate enthusiast, DebateSim provides an interactive and educational platform to enhance critical thinking, argumentation, and decision-making skills. 

# Features
- **AI Debaters**: Simulate debates with AI participants capable of representing opposing viewpoints.
- **AI Judges**: Let the AI evaluate debates based on structured criteria, offering feedback and scoring.
- **User-Controlled Interaction**: Choose the roles for AI (debaters, judges, or both) while optionally participating as a debater or judge.
- **Customizable Topics**: Input any debate resolution or topic for tailored simulations.
- **Debate Formats**: Supports popular formats such as Lincoln-Douglas, Public Forum, or custom styles.
- **Scoring and Feedback**: Provides in-depth feedback on arguments, counterarguments, and debate strategies. 

# Usage
1. Run the simulation
2. Choose a mode:
- AI as both debaters and judge (full simulation)
- AI as debaters, user as judge
- AI as judge, users as debaters
- AI as judge and debater, user as other debater
3. Input Debate Parameters:
- Select a format (e.g. Free-for-all crossfire, LD, PF, CX, etc.)
- Provide a debate resolution or topic
4.	Interact with the Simulation:
- View arguments, counterarguments, and judge decisions.
- Pause, rewind, or modify debates dynamically.

# Setup
1. `pip install -r requirements.txt`
2. navigate to frontend folder, `npm install`
3. create a .env file in root, append `OPENROUTER_API_KEY=`
4. To run, navigate to root and run `python -m uvicorn main:app --reload`
5. Then navigate to frontend and run `npm run dev`
6. Navigate to api.js and update the link

# Virtual Machine
1. Log into VM: `ssh azureuser@20.3.246.40`
2. Set up python venv: `source ./venv/bin/activate`
3. Start backend: `uvicorn main:app --host 0.0.0.0 --port 5000 --reload`
4. Move to frontend directory: `cd frontend`
5. Build frontend: `npm run build`
6. Run frontend: `npx serve -s dist -l 3000 --no-clipboard --single`

To run indefinitely: 
- Backend: `nohup uvicorn main:app --host 0.0.0.0 --port 5000 --reload > backend.log 2>&1 &`
- Frontend: `nohup npx serve -s dist -l 3000 --no-clipboard --single > frontend.log 2>&1 & disown`

*Check processes: `sudo netstat -tulnp | grep <port>` or `ps aux | grep serve`
*To kill processes: `kill -9 <PID>` 



# Example
1.	Start DebateSim
2.	Select a mode: AI as both debaters and judge
3.	Enter a debate topic: "Resolved: Artificial Intelligence will do more harm than good in the next decade."
4.	Watch the debate unfold:
[AI Debater 1]: Opening Statement...
[AI Debater 2]: Rebuttal...
5.	Review judge feedback: [AI Judge] - Based on logical coherence, evidence, and rhetorical skill...

# Contributing 
1. Make a new branch `git checkout -b branch-name` (replace branch-name with the name of the branch such as the feature you made)
2. `git add .`
3. `git commit`
    - 3a. type `i` in the termainl to enter insert mode 
    - 3b. on the first line type your commit message (be specific)
    - 3c. on the second line type `close #xxx` where xxx is the issue number
    - 3d. type `:wq` then enter to exit out
4. `git push origin branch-name`
5. Go to GitHub, click pull requests, new pull request, create one
6. Once your pull request is reviewed + merged, the branch will be deleted. The next time you work on the project, go back to the main branch with `git checkout main` and run `git pull`

# Acknowledgments
- **OpenAI**: For providing the foundational AI capabilities.
- **Debate Organizations**: For inspiration in structuring the debate formats.
- **Community Contributors**: For valuable input and suggestions.

Ready to dive into the debate? Start with DebateSim and experience the power of AI in argumentation!