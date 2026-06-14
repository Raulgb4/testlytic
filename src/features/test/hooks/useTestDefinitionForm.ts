import { FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { CollectionQuestion } from "../questionCollectionTypes";
import { TestDefinition } from "../testTypes";
import { getCategoryOptions, getSubcategoryOptions } from "../testUtils";
import { isTimeLimitEnabled } from "../testRuntimeUtils";
import {
  INITIAL_FORM,
  isSameStringList,
  TestFormState,
  validateDefinitionForm,
} from "../definition/testDefinitionForm";

export function useTestDefinitionForm({
  bankQuestions,
  definitions,
  onSaveDefinition,
}: {
  bankQuestions: CollectionQuestion[];
  definitions: TestDefinition[];
  onSaveDefinition: (definition: TestDefinition) => void;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [formState, setFormState] = useState<TestFormState>(INITIAL_FORM);
  const [editingTestId, setEditingTestId] = useState<string | null>(null);
  const [formTouched, setFormTouched] = useState(false);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const questionLimitInputRef = useRef<HTMLInputElement | null>(null);
  const categoriesTriggerRef = useRef<HTMLButtonElement | null>(null);
  const timeLimitInputRef = useRef<HTMLInputElement | null>(null);
  const penaltyInputRef = useRef<HTMLInputElement | null>(null);
  const categoryOptions = useMemo(() => getCategoryOptions(bankQuestions), [bankQuestions]);
  const subcategoryOptions = useMemo(
    () => getSubcategoryOptions(bankQuestions, formState.includedCategories),
    [bankQuestions, formState.includedCategories],
  );

  useEffect(() => {
    if (!formOpen) return;
    setFormState((current) => {
      const availableCategories = new Set(categoryOptions);
      const nextCategories = current.includedCategories.filter((category) =>
        availableCategories.has(category),
      );
      const allowedSubcategories = getSubcategoryOptions(bankQuestions, nextCategories);
      const availableSubcategories = new Set(allowedSubcategories);
      const nextSubcategories = current.includedSubcategories.filter((subcategory) =>
        availableSubcategories.has(subcategory),
      );

      if (
        isSameStringList(nextCategories, current.includedCategories) &&
        isSameStringList(nextSubcategories, current.includedSubcategories)
      ) {
        return current;
      }

      return {
        ...current,
        includedCategories: nextCategories,
        includedSubcategories: nextSubcategories,
      };
    });
  }, [bankQuestions, categoryOptions, formOpen]);

  const openCreate = () => {
    setEditingTestId(null);
    setFormTouched(false);
    setFormState({
      ...INITIAL_FORM,
      questionLimit: Math.min(20, Math.max(1, bankQuestions.length)),
      includedCategories: categoryOptions.length > 0 ? [categoryOptions[0]] : [],
    });
    setFormOpen(true);
  };

  const openEdit = (definition: TestDefinition) => {
    setEditingTestId(definition.id);
    setFormTouched(false);
    setFormState({
      title: definition.title,
      questionLimit: definition.questionLimit,
      includedCategories: definition.includedCategories,
      includedSubcategories: definition.includedSubcategories || [],
      allowUnanswered: definition.allowUnanswered,
      timeLimitEnabled: isTimeLimitEnabled(definition),
      negativeMarkingEnabled: definition.negativeMarkingEnabled,
      penaltyPerIncorrectAnswer: definition.penaltyPerIncorrectAnswer,
      timeLimitMinutes: definition.timeLimitMinutes,
    });
    setFormOpen(true);
  };

  const formValidation = validateDefinitionForm(formState, bankQuestions);
  const showErrors = formTouched;

  const saveDefinition = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFormTouched(true);
    if (formValidation.summary.length > 0) {
      const firstError = formValidation.order.find((key) => Boolean(formValidation.errors[key]));
      if (firstError === "title") titleInputRef.current?.focus();
      if (firstError === "questionLimit") questionLimitInputRef.current?.focus();
      if (firstError === "includedCategories") categoriesTriggerRef.current?.focus();
      if (firstError === "timeLimitMinutes") timeLimitInputRef.current?.focus();
      if (firstError === "penaltyPerIncorrectAnswer") penaltyInputRef.current?.focus();
      return;
    }

    const now = new Date().toISOString();
    const generatedId = `test-${Date.now()}`;
    const payload: TestDefinition = {
      id: editingTestId || generatedId,
      title: formState.title.trim(),
      questionLimit: formState.questionLimit,
      includedCategories: formState.includedCategories,
      includedSubcategories: formState.includedSubcategories,
      allowUnanswered: formState.allowUnanswered,
      timeLimitEnabled: formState.timeLimitEnabled,
      negativeMarkingEnabled: formState.negativeMarkingEnabled,
      penaltyPerIncorrectAnswer: formState.negativeMarkingEnabled
        ? formState.penaltyPerIncorrectAnswer
        : 0,
      timeLimitMinutes: formState.timeLimitEnabled ? formState.timeLimitMinutes : 0,
      createdAt: editingTestId
        ? definitions.find((item) => item.id === editingTestId)?.createdAt || now
        : now,
      updatedAt: now,
    };

    onSaveDefinition(payload);
    setFormOpen(false);
  };

  const updateIncludedCategories = (next: string[]) => {
    const allowedSubcategories = getSubcategoryOptions(bankQuestions, next);
    setFormState((current) => ({
      ...current,
      includedCategories: next,
      includedSubcategories: current.includedSubcategories.filter((item) =>
        allowedSubcategories.includes(item),
      ),
    }));
  };

  return {
    formOpen,
    setFormOpen,
    formState,
    setFormState,
    editingTestId,
    titleInputRef,
    questionLimitInputRef,
    categoriesTriggerRef,
    timeLimitInputRef,
    penaltyInputRef,
    categoryOptions,
    subcategoryOptions,
    openCreate,
    openEdit,
    formValidation,
    showErrors,
    saveDefinition,
    updateIncludedCategories,
  };
}
