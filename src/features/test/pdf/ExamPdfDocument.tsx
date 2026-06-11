import { Document, Page, StyleSheet, Text, View } from "@react-pdf/renderer";
import { ExamPdfAnswerKeyItem, ExamPdfPayload } from "./examPdfTypes";
import { ANSWER_ROWS_PER_PAGE, chunkItems, getOptionLabel } from "./pdfLayoutUtils";

const PAGE_MARGIN = 36;
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
    flex: 1,
    fontSize: 10.5,
    fontWeight: 700,
    lineHeight: 1.35,
  },
  questionPromptRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    marginBottom: 5,
  },
  questionNumber: {
    width: 34,
    paddingRight: 8,
    fontSize: 10.5,
    fontWeight: 700,
    lineHeight: 1.35,
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
    padding: 7,
    marginBottom: 12,
  },
  answerSheetTitle: {
    fontSize: 11,
    fontWeight: 700,
    textAlign: "center",
    marginBottom: 7,
  },
  formRow: {
    flexDirection: "row",
    marginBottom: 6,
  },
  formField: {
    flex: 1,
    marginRight: 6,
  },
  formFieldWide: {
    flex: 1.4,
    marginRight: 6,
  },
  formFieldLabel: {
    fontSize: 7,
    fontWeight: 700,
    marginBottom: 2,
    textTransform: "uppercase",
  },
  formFieldBlank: {
    height: 18,
    borderWidth: 1,
    borderColor: "#111111",
  },
  signatureBlank: {
    height: 28,
    borderWidth: 1,
    borderColor: "#111111",
  },
  accessField: {
    flex: 2.2,
    marginRight: 6,
  },
  accessOptions: {
    minHeight: 18,
    borderWidth: 1,
    borderColor: "#111111",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 6,
  },
  accessOption: {
    flexDirection: "row",
    alignItems: "center",
  },
  accessBox: {
    width: 7,
    height: 7,
    borderWidth: 1,
    borderColor: "#111111",
    marginRight: 3,
  },
  accessLabel: {
    fontSize: 7,
    marginRight: 10,
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
      <Text render={({ pageNumber, totalPages }) => `Página ${pageNumber} / ${totalPages}`} />
    </View>
  );
}

function FormField({ label, wide = false }: { label: string; wide?: boolean }) {
  return (
    <View style={wide ? styles.formFieldWide : styles.formField}>
      <Text style={styles.formFieldLabel}>{label}</Text>
      <View style={styles.formFieldBlank} />
    </View>
  );
}

function AccessField() {
  const options = ["Promoción interna", "Libre", "Discapacidad"];
  return (
    <View style={styles.accessField}>
      <Text style={styles.formFieldLabel}>Acceso</Text>
      <View style={styles.accessOptions}>
        {options.map((option) => (
          <View key={option} style={styles.accessOption}>
            <View style={styles.accessBox} />
            <Text style={styles.accessLabel}>{option}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function AnswerSheetForm() {
  return (
    <View style={styles.answerSheetHeader}>
      <Text style={styles.answerSheetTitle}>HOJA DE RESPUESTAS</Text>
      <View style={styles.formRow}>
        <FormField label="1º apellido" />
        <FormField label="2º apellido" />
        <FormField label="Nombre" />
      </View>
      <View style={styles.formRow}>
        <FormField label="Convocatoria" />
        <FormField label="Ejercicio" />
        <FormField label="Localidad" />
      </View>
      <View style={styles.formRow}>
        <AccessField />
        <FormField label="DNI" />
      </View>
      <View style={styles.formRow}>
        <View style={styles.formFieldWide}>
          <Text style={styles.formFieldLabel}>Firma</Text>
          <View style={styles.signatureBlank} />
        </View>
      </View>
    </View>
  );
}

function CoverPage({ payload }: { payload: ExamPdfPayload }) {
  const metadataRows = [
    ["Generado", new Date(payload.generatedAt).toLocaleString()],
    ["Preguntas", String(payload.metadata.questionCount)],
    ["Categorías", payload.metadata.categorySummary],
    ["Subcategorías", payload.metadata.subcategorySummary],
    ["Tiempo límite", payload.metadata.timeLimit],
    ["Penalización", payload.metadata.negativeMarking],
    ["Permite sin responder", payload.metadata.allowUnanswered],
  ];

  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.coverTitle}>{payload.definition.title}</Text>
      <Text style={styles.coverSubtitle}>
        Test de oposición imprimible generado localmente por Testlytic
      </Text>

      <Text style={styles.sectionTitle}>Información del test</Text>
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

      <Text style={styles.sectionTitle}>Instrucciones generales</Text>
      <Text style={styles.instructions}>
        Lea atentamente cada pregunta antes de responder. Marque las respuestas con claridad en la
        hoja de respuestas. Las respuestas incorrectas pueden aplicar la penalización configurada.
        Reserve tiempo para revisar y trasladar sus respuestas limpiamente. Esta exportación PDF no
        inicia una sesión de Testlytic ni afecta a estadísticas o recuentos de exposición.
      </Text>
      <PageFooter title="Exportación PDF de Testlytic" />
    </Page>
  );
}

function ExamPages({ payload }: { payload: ExamPdfPayload }) {
  return (
    <Page size="A4" style={styles.page} wrap>
      <View style={styles.header} fixed>
        <Text>{payload.definition.title}</Text>
        <Text>Preguntas</Text>
      </View>
      {payload.questions.map((question) => (
        <View key={`${question.id}-${question.number}`} style={styles.questionBlock} wrap={false}>
          <View style={styles.questionPromptRow}>
            <Text style={styles.questionNumber}>{question.number}.</Text>
            <Text style={styles.questionText}>{question.question}</Text>
          </View>
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
      <PageFooter title="Preguntas" />
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
            <Text>Hoja de respuestas</Text>
          </View>
          <AnswerSheetForm />
          <View style={styles.answerTable}>
            <View style={styles.answerRow}>
              <Text style={styles.answerNumber}>Nº</Text>
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
          <PageFooter title="Hoja de respuestas" />
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
            <Text>Soluciones</Text>
          </View>
          <Text style={styles.sectionTitle}>Plantilla de respuestas</Text>
          <View style={styles.solutionGrid}>
            {items.map((item: ExamPdfAnswerKeyItem) => (
              <Text key={item.questionNumber} style={styles.solutionItem}>
                {item.questionNumber}. {item.correctLabels.join(", ") || "-"}
              </Text>
            ))}
          </View>
          <PageFooter title="Soluciones" />
        </Page>
      ))}
    </>
  );
}

export function ExamPdfDocument({ payload }: { payload: ExamPdfPayload }) {
  return (
    <Document
      title={payload.definition.title}
      author="Testlytic"
      subject="Exportación PDF imprimible"
    >
      <CoverPage payload={payload} />
      <ExamPages payload={payload} />
      <AnswerSheetPages payload={payload} />
      <SolutionPages payload={payload} />
    </Document>
  );
}
