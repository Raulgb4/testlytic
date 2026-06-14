# Testlytic

A modern desktop application for creating, practicing, and analyzing multiple-choice tests.

## Overview

Testlytic is a lightweight desktop application designed to help users study more effectively through multiple-choice tests. It supports question banks from any domain, including certifications, academic exams, technical training, language learning, professional development, and self-study.

The application focuses on providing a fast, intuitive, and data-driven learning experience through customizable tests and detailed performance analytics.

Unlike online quiz platforms, Testlytic is designed as a personal productivity tool. Users manage their own question banks, test history, and statistics locally on their device.

---

## Core Features

Testlytic is built around four main pillars:

- Import question banks
- Organize questions
- Practice tests
- Analyze performance

The goal is to transform test-based learning into a measurable and structured process.

---

## How It Works

The typical workflow is:

```text
Source Document → JSON Conversion → Import → Practice → Analytics
```

Questions are primarily imported from JSON files and stored locally in a SQLite database.

Each question may contain:

- Question statement
- Multiple answer options
- Correct answer
- Topic or category
- Optional explanation
- Optional difficulty level
- Optional tags

Questions can be organized by:

- Topic
- Category
- Difficulty
- Tags
- Learning status

---

## Practice Modes

Testlytic supports different study workflows:

- Practice Mode
- Exam Simulation Mode
- Error Review Mode
- Topic-Based Practice
- Random Practice

Users can configure:

- Number of questions
- Time limit
- Negative marking
- Unanswered questions
- Topic selection
- Random order

---

## Test History

Each completed test stores information such as:

- Title
- Date
- Category
- Number of questions
- Time spent
- Correct answers
- Incorrect answers
- Unanswered questions
- Final score
- Average score

This allows users to track progress over time.

---

## Analytics

One of the key goals of Testlytic is helping users identify strengths and weaknesses through data.

Analytics may include:

- Overall average score
- Performance trends
- Weakest topics
- Most frequently missed questions
- Average completion time
- Topic accuracy rates
- Learning progress over time

The objective is to provide actionable insights rather than just displaying results.

---

## Design Principles

Testlytic follows a modern desktop-first approach:

- Simple
- Fast
- Clean
- Visual
- User-friendly

The interface prioritizes:

- Easy navigation
- Light and dark themes
- Clear dashboards
- Meaningful charts
- Productive workflows

The visual style is inspired by Chronolytic, focusing on clarity and usability.

---

## Version 1 Scope

The first release focuses on the essential features:

- Question import
- Question management
- Test generation
- Test execution
- Results review
- Basic analytics

Advanced functionality will be added in future releases.

---

## Technology Stack

### Frontend

- React
- TypeScript
- Tailwind CSS

### Desktop Framework

- Tauri

### Database

- SQLite

### Data Flow

```text
JSON → Validation → SQLite → Tests → Analytics
```

---

## Development Validation

Install dependencies with the pinned pnpm version:

```bash
pnpm install
```

Before merging changes, run the same frontend quality gates used by GitHub CI:

```bash
pnpm run validate
```

This runs formatting checks, TypeScript type checking, the Vitest suite, the production build, Rust formatting, and Rust clippy.

---

## Project Architecture

Planned core modules:

- Dashboard
- Question Importer
- Question Manager
- Test Generator
- Test Session
- Results Viewer
- History
- Analytics

---

## Development Approach

The project prioritizes:

- Rapid iteration
- Clean architecture
- Maintainability
- Practical usefulness
- Minimal complexity

The focus is on building a reliable and useful application rather than an overly feature-rich platform.

---

## Long-Term Vision

Testlytic aims to become a modern and efficient desktop application for test-based learning, helping users improve performance through structured practice and meaningful analytics.

The project combines simplicity, speed, and data-driven insights to create a better learning experience.
