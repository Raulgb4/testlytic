import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { ExamPdfAnswerKeyItem, ExamPdfPayload } from "./examPdfTypes";
import { chunkItems, getOptionLabel } from "./pdfLayoutUtils";

const PAGE_MARGIN = 36;
const ANSWER_ROWS_PER_PAGE = 42;
const SOLUTION_ROWS_PER_PAGE = 72;

const styles = StyleSheet.create({
  page: {
    paddingTop: PAGE_MARGIN,
    paddingRight: PAGE_MARGIN,
    paddingBottom: PAGE_MARGIN,
    paddingLeft: PAGE_MARGIN,
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#111111",
    backgroundColor: "#ffffff",
  },
  coverTitle: {
    fontSize: 22,
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 8,
    textTransform: "uppercase",
  },
  coverSubtitle: {
    fontSize: 11,
    textAlign: "center",
    marginBottom: 28,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 8,
    textTransform: "uppercase",
    borderBottomWidth: 1,
    borderBottomColor: "#111111",
    paddingBottom: 4,
  },
  metadataGrid: {
    borderWidth: 1,
    borderColor: "#111111",
    marginBottom: 20,
  },
  metadataRow: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#111111",
  },
  metadataRowLast: {
    flexDirection: "row",
  },
  metadataLabel: {
    width: "38%",
    padding: 6,
    fontWeight: 700,
    borderRightWidth: 1,
    borderRightColor: "#111111",
  },
  metadataValue: {
    width: "62%",
    padding: 6,
  },
  instructions: {
    borderWidth: 1,
    borderColor: "#111111",
    padding: 10,
    lineHeight: 1.45,
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#111111",
    paddingBottom: 6,
    marginBottom: 12,
    fontSize: 8,
  },
  footer: {
    position: "absolute",
    left: PAGE_MARGIN,
    right: PAGE_MARGIN,
    bottom: 18,
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: "#777777",
    paddingTop: 4,
    fontSize: 8,
    color: "#444444",
  },
  questionBlock: {
    marginBottom: 10,
    paddingBottom: 8,
    borderBottomWidth: 0.5,
    borderBottomColor: "#cccccc",
  },
  questionText: {
    fontSize: 10.5,
    lineHeight: 1.35,
    marginBottom: 5,
  },
  auxiliary: {
    fontSize: 9,
    lineHeight: 1.35,
    marginBottom: 6,
    padding: 6,
    borderWidth: 0.5,
    borderColor: "#777777",
  },
  optionRow: {
    flexDirection: "row",
    marginBottom: 3,
    lineHeight: 1.25,
  },
  optionLabel: {
    width: 22,
    fontWeight: 700,
  },
  optionText: {
    flex: 1,
  },
  answerSheetHeader: {
    borderWidth: 1,
    borderColor: "#111111",
    padding: 8,
    marginBottom: 12,
  },
  identityLine: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 8,
    fontSize: 9,
  },
  answerTable: {
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderColor: "#111111",
  },
  answerRow: {
    flexDirection: "row",
    minHeight: 15,
    borderBottomWidth: 1,
    borderBottomColor: "#111111",
  },
  answerNumber: {
    width: 38,
    paddingTop: 3,
    textAlign: "center",
    borderRightWidth: 1,
    borderRightColor: "#111111",
    fontSize: 8,
    fontWeight: 700,
  },
  bubbleCell: {
    flex: 1,
    minWidth: 32,
    borderRightWidth: 1,
    borderRightColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
  },
  bubbleCellUnavailable: {
    flex: 1,
    minWidth: 32,
    borderRightWidth: 1,
    borderRightColor: "#111111",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#eeeeee",
  },
  bubble: {
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: "#111111",
  },
  bubbleLabel: {
    fontSize: 7,
    marginBottom: 1,
  },
  solutionGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  solutionItem: {
    width: "25%",
    marginBottom: 5,
    fontSize: 9,
  },
});

function PageFooter({ title }: { title: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{title}</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function CoverPage({ payload }: { payload: ExamPdfPayload }) {
  const metadataRows = [
    ["Generated", new Date(payload.generatedAt).toLocaleString()],
    ["Questions", String(payload.metadata.questionCount)],
    ["Categories", payload.metadata.categorySummary],
    ["Subcategories", payload.metadata.subcategorySummary],
    ["Time limit", payload.metadata.timeLimit],
    ["Negative marking", payload.metadata.negativeMarking],
    ["Allow unanswered", payload.metadata.allowUnanswered],
  ];

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.coverTitle}>{payload.definition.title}</Text>
      <Text style={styles.coverSubtitle}>
        Printable opposition exam generated locally by Testlytic
      </Text>

      <Text style={styles.sectionTitle}>Exam Information</Text>
      <View style={styles.metadataGrid}>
        {metadataRows.map(([label, value], index) => (
          <View
            key={label}
            style={index === metadataRows.length - 1 ? styles.metadataRowLast : styles.metadataRow}
          >
            <Text style={styles.metadataLabel}>{label}</Text>
            <Text style={styles.metadataValue}>{value}</Text>
          </View>
        ))}
      </View>

      <Text style={styles.sectionTitle}>General Instructions</Text>
      <Text style={styles.instructions}>
        Read every question carefully before answering. Mark answers clearly on the answer sheet.
        Wrong answers may apply the configured penalty. Reserve time to review your answers and
        transfer them cleanly. This PDF export does not start a Testlytic session and does not
        affect analytics or exposure counts.
      </Text>
      <PageFooter title="Testlytic PDF Export" />
    </Page>
  );
}

function ExamPages({ payload }: { payload: ExamPdfPayload }) {
  return (
    <Page size="A4" style={styles.page} wrap>
      <View style={styles.header} fixed>
        <Text>{payload.definition.title}</Text>
        <Text>Exam Questions</Text>
      </View>
      {payload.questions.map((question) => (
        <View key={`${question.id}-${question.number}`} style={styles.questionBlock} wrap={false}>
          <Text style={styles.questionText}>
            {question.number}. {question.question}
          </Text>
          {question.auxiliaryInformation ? (
            <Text style={styles.auxiliary}>{question.auxiliaryInformation}</Text>
          ) : null}
          {question.options.map((option, index) => (
            <View key={option.id} style={styles.optionRow}>
              <Text style={styles.optionLabel}>{getOptionLabel(index)})</Text>
              <Text style={styles.optionText}>{option.text}</Text>
            </View>
          ))}
        </View>
      ))}
      <PageFooter title="Exam Questions" />
    </Page>
  );
}

function AnswerSheetPages({ payload }: { payload: ExamPdfPayload }) {
  const questionPages = chunkItems(payload.questions, ANSWER_ROWS_PER_PAGE);
  const labels = Array.from({ length: payload.maxOptionCount }, (_, index) =>
    getOptionLabel(index),
  );

  return (
    <>
      {questionPages.map((questions, pageIndex) => (
        <Page key={`answer-${pageIndex}`} size="A4" style={styles.page}>
          <View style={styles.header} fixed>
            <Text>{payload.definition.title}</Text>
            <Text>Answer Sheet</Text>
          </View>
          <View style={styles.answerSheetHeader}>
            <Text>ANSWER SHEET</Text>
            <View style={styles.identityLine}>
              <Text>Name: ____________________________________</Text>
              <Text>Date: __________________</Text>
            </View>
          </View>
          <View style={styles.answerTable}>
            <View style={styles.answerRow}>
              <Text style={styles.answerNumber}>No.</Text>
              {labels.map((label) => (
                <View key={label} style={styles.bubbleCell}>
                  <Text style={styles.bubbleLabel}>{label}</Text>
                </View>
              ))}
            </View>
            {questions.map((question) => (
              <View key={`answer-row-${question.number}`} style={styles.answerRow}>
                <Text style={styles.answerNumber}>{question.number}</Text>
                {labels.map((label, index) => {
                  const available = index < question.options.length;
                  return (
                    <View
                      key={`${question.number}-${label}`}
                      style={available ? styles.bubbleCell : styles.bubbleCellUnavailable}
                    >
                      {available ? <View style={styles.bubble} /> : <Text>-</Text>}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
          <PageFooter title="Answer Sheet" />
        </Page>
      ))}
    </>
  );
}

function SolutionPages({ payload }: { payload: ExamPdfPayload }) {
  const pages = chunkItems(payload.answerKey, SOLUTION_ROWS_PER_PAGE);
  return (
    <>
      {pages.map((items, pageIndex) => (
        <Page key={`solutions-${pageIndex}`} size="A4" style={styles.page}>
          <View style={styles.header} fixed>
            <Text>{payload.definition.title}</Text>
            <Text>Solutions</Text>
          </View>
          <Text style={styles.sectionTitle}>Answer Key</Text>
          <View style={styles.solutionGrid}>
            {items.map((item: ExamPdfAnswerKeyItem) => (
              <Text key={item.questionNumber} style={styles.solutionItem}>
                {item.questionNumber}. {item.correctLabels.join(", ") || "-"}
              </Text>
            ))}
          </View>
          <PageFooter title="Solutions" />
        </Page>
      ))}
    </>
  );
}

export function ExamPdfDocument({ payload }: { payload: ExamPdfPayload }) {
  return (
    <Document title={payload.definition.title} author="Testlytic" subject="Printable exam export">
      <CoverPage payload={payload} />
      <ExamPages payload={payload} />
      <AnswerSheetPages payload={payload} />
      <SolutionPages payload={payload} />
    </Document>
  );
}
