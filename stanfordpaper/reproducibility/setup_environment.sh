#!/bin/bash
# Environment setup script for reproducibility package

set -e  # Exit on any error

echo "Setting up environment for Chain-of-Thought Evaluation and Drift Analysis..."

# Check Python version
python_version=$(python3 --version 2>&1 | cut -d' ' -f2 | cut -d'.' -f1,2)
required_version="3.9"

if [ "$(printf '%s\n' "$required_version" "$python_version" | sort -V | head -n1)" != "$required_version" ]; then
    echo "❌ Python 3.9+ required, found $python_version"
    exit 1
fi

echo "✅ Python version: $python_version"

# Create virtual environment
if [ ! -d "venv" ]; then
    echo "Creating virtual environment..."
    python3 -m venv venv
fi

# Activate virtual environment
echo "Activating virtual environment..."
source venv/bin/activate

# Upgrade pip
echo "Upgrading pip..."
pip install --upgrade pip

# Install dependencies
echo "Installing dependencies..."
pip install -r requirements.txt

# Create necessary directories
echo "Creating directories..."
mkdir -p results
mkdir -p logs
mkdir -p checkpoints

# Set up environment variables template
if [ ! -f ".env.template" ]; then
    echo "Creating environment variables template..."
    cat > .env.template << EOF
# API Keys (replace with your actual keys)
OPENAI_API_KEY=your_openai_api_key_here
ANTHROPIC_API_KEY=your_anthropic_api_key_here
GOOGLE_API_KEY=your_google_api_key_here
HUGGINGFACE_API_KEY=your_huggingface_api_key_here

# Model Configuration
DEFAULT_MODEL=gpt-4o-mini
DEFAULT_TEMPERATURE=0.7
DEFAULT_MAX_TOKENS=1000

# Hardware Configuration
USE_GPU=true
CUDA_VISIBLE_DEVICES=0

# Logging
LOG_LEVEL=INFO
LOG_FILE=logs/experiment.log
EOF
fi

# Copy template to .env if it doesn't exist
if [ ! -f ".env" ]; then
    echo "Creating .env file from template..."
    cp .env.template .env
    echo "⚠️  Please edit .env file with your actual API keys"
fi

# Test installation
echo "Testing installation..."
python3 -c "import numpy, pandas, sklearn, sentence_transformers; print('✅ Core dependencies working')"

# Run basic tests
echo "Running basic tests..."
python3 test_reproducibility.py

echo "🎉 Environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env file with your API keys"
echo "2. Run 'make reproduce' to reproduce all experiments"
echo "3. Or run individual components with 'make run-drift', 'make run-cot', etc."
echo ""
echo "For Docker setup, run:"
echo "  cd docker && docker build -t debate-sim ."
