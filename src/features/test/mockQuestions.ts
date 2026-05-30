import { MockQuestion, TestConfig } from "./testTypes";

export const MOCK_QUESTIONS: MockQuestion[] = [
  {
    id: "q1",
    statement: "Which metric best represents overall test reliability over time?",
    topic: "Analytics",
    category: "Core Metrics",
    options: [
      { id: "a", text: "Single highest score" },
      { id: "b", text: "Average score across completed tests" },
      { id: "c", text: "Most recent category attempted" },
      { id: "d", text: "First question response speed" },
    ],
    correctOptionId: "b",
    explanation:
      "Average score across completed sessions is stable and comparable across time windows.",
  },
  {
    id: "q2",
    statement:
      "In local-first architecture, which statement is correct for Testlytic MVP direction?",
    topic: "Architecture",
    category: "Persistence",
    options: [
      { id: "a", text: "User data should be sent to external APIs by default" },
      { id: "b", text: "Study history should be ephemeral between sessions" },
      { id: "c", text: "User data should remain on-device unless explicitly exported" },
      { id: "d", text: "Only aggregate analytics should be stored" },
    ],
    correctOptionId: "c",
    explanation: "Local-first means user learning data remains on-device as the default behavior.",
  },
  {
    id: "q3",
    statement: "What is the primary value of topic-level analytics?",
    topic: "Analytics",
    category: "Topics",
    options: [
      { id: "a", text: "Detect strongest and weakest topic performance" },
      { id: "b", text: "Increase randomization entropy" },
      { id: "c", text: "Replace score calculations" },
      { id: "d", text: "Disable unanswered question state" },
    ],
    correctOptionId: "a",
    explanation: "Topic-level views help identify where to focus future practice sessions.",
  },
  {
    id: "q4",
    statement: "If negative marking is enabled, what should happen in scoring?",
    topic: "Scoring",
    category: "Rules",
    options: [
      { id: "a", text: "Incorrect answers should apply configured penalty" },
      { id: "b", text: "Unanswered answers should always be penalized" },
      { id: "c", text: "Correct answers should be reduced by penalty" },
      { id: "d", text: "Final score should ignore incorrect responses" },
    ],
    correctOptionId: "a",
    explanation:
      "Negative marking applies only to incorrect answers based on the configured penalty.",
  },
  {
    id: "q5",
    statement: "Why keep unanswered as a first-class response state?",
    topic: "UX",
    category: "Session Flow",
    options: [
      { id: "a", text: "To distinguish skipped from incorrect for review insights" },
      { id: "b", text: "To guarantee perfect completion time" },
      { id: "c", text: "To avoid calculating analytics" },
      { id: "d", text: "To disable progress tracking" },
    ],
    correctOptionId: "a",
    explanation: "Unanswered questions inform review and analysis differently than wrong answers.",
  },
  {
    id: "q6",
    statement: "Which import workflow matches the intended Testlytic data flow in docs?",
    topic: "Import",
    category: "Workflow",
    options: [
      { id: "a", text: "SQLite -> JSON -> Validation -> Tests" },
      { id: "b", text: "JSON -> Validation -> SQLite -> Tests -> Analytics" },
      { id: "c", text: "CSV -> Browser Cache -> Charts" },
      { id: "d", text: "Analytics -> Import -> Question Bank" },
    ],
    correctOptionId: "b",
    explanation:
      "The intended flow is JSON import, validation, persistence, then test and analytics generation.",
  },
];

export const DEFAULT_TEST_CONFIG: TestConfig = {
  title: "Practice Session",
  topicCategory: "All Topics",
  questionCount: 5,
  timeLimitMinutes: 20,
  negativeMarking: false,
  negativeMarkingValue: 0.25,
  allowUnanswered: true,
};
