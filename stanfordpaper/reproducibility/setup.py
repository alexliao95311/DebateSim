#!/usr/bin/env python3
"""
Setup script for the reproducibility package
"""

from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

with open("requirements.txt", "r", encoding="utf-8") as fh:
    requirements = [line.strip() for line in fh if line.strip() and not line.startswith("#")]

setup(
    name="cot-debate-drift",
    version="1.0.0",
    author="Anonymous Authors",
    author_email="anonymous@example.com",
    description="Chain-of-Thought Evaluation and Drift Analysis for Multi-Agent AI Debate Systems",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/alexliao95311/cot-debate-drift",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 4 - Beta",
        "Intended Audience :: Science/Research",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.9",
        "Programming Language :: Python :: 3.10",
        "Programming Language :: Python :: 3.11",
        "Topic :: Scientific/Engineering :: Artificial Intelligence",
    ],
    python_requires=">=3.9",
    install_requires=requirements,
    extras_require={
        "dev": [
            "pytest>=6.0",
            "black>=21.0",
            "flake8>=3.8",
            "mypy>=0.800",
        ],
    },
    entry_points={
        "console_scripts": [
            "cot-benchmark=scripts.cot_benchmark:main",
            "drift-analyzer=scripts.drift_analyzer:main",
            "gamestate-manager=scripts.gamestate_manager:main",
            "reproduce-experiments=scripts.reproduce_experiments:main",
        ],
    },
    include_package_data=True,
    package_data={
        "": ["*.json", "*.txt", "*.yaml", "*.yml"],
    },
)
