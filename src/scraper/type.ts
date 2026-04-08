// ===============================
// 🧠 Threadline Strategy System
// ===============================

// ---------- Core Strategy ----------

export interface Strategy {
    platform: Platform;
    task: string;

    meta: Meta;

    input: Record<string, string>;

    flow: Step[];

    validation?: Validation;

    fallback?: Fallback;

    memory?: Memory;
}

// ---------- Platform ----------

export interface Platform {
    name: string;
    base_url: string;
    match: string[]; // domains or patterns
}

// ---------- Meta ----------

export interface Meta {
    version: number;
    created_at: string;
    last_verified: string | null;

    success_rate: number; // 0 → 1
    confidence: number;   // 0 → 1

    mode: "rule" | "ai" | "hybrid";
}

// ---------- Step System ----------

export type Step =
    | GotoStep
    | ClickStep
    | WaitStep
    | ScrollStep
    | ExtractStep;

// ---------- Base Step ----------

interface BaseStep {
    id: string;
    action: StepAction;

    retry?: {
        attempts: number;
        delay: number;
    };

    fallback?: StepFallback;

    ai_hint?: string;
}

// ---------- Step Actions ----------

export type StepAction =
    | "goto"
    | "click"
    | "wait"
    | "scroll"
    | "extract";

// ---------- Goto ----------

export interface GotoStep extends BaseStep {
    action: "goto";
    url: string; // supports {{variables}}
}

// ---------- Click ----------

export interface ClickStep extends BaseStep {
    action: "click";
    selectors: string[];
    target?: "page" | "modal";
}

// ---------- Wait ----------

export interface WaitStep extends BaseStep {
    action: "wait";
    selectors: string[];
    timeout?: number;
}

// ---------- Scroll ----------

export interface ScrollStep extends BaseStep {
    action: "scroll";

    target?: "page" | "modal";

    strategy?: "infinite" | "fixed";

    max_scrolls?: number;

    delay_range?: [number, number];
}

// ---------- Extract ----------

export interface ExtractStep extends BaseStep {
    action: "extract";

    target?: "page" | "modal";

    schema: ExtractSchema;
}

// ---------- Extraction Schema ----------

export interface ExtractSchema {
    container: string;

    fields: Record<string, ExtractField>;
}

// ---------- Field Types ----------

export type ExtractField =
    | TextField
    | AttributeField;

// ---------- Text Field ----------

export interface TextField {
    type: "text";
    selector?: string | null;
}

// ---------- Attribute Field ----------

export interface AttributeField {
    type: "attribute";
    attr: string;
    selector?: string | null;
}

// ---------- Validation ----------

export interface Validation {
    mode: "step" | "final";

    rules: ValidationRule[];
}

// ---------- Validation Rules ----------

export type ValidationRule =
    | MinCountRule
    | NoDuplicatesRule;

export interface MinCountRule {
    type: "min_count";
    value: number;
}

export interface NoDuplicatesRule {
    type: "no_duplicates";
    field: string;
}

// ---------- Fallback ----------

export interface Fallback {
    on_failure: "relearn" | "retry";

    ai_prompt?: {
        goal: string;
        instructions: string[];
    };
}

// ---------- Step-level fallback ----------

export interface StepFallback {
    type: "ai" | "skip" | "fail";
}

// ---------- Memory ----------

export interface Memory {
    selector_history: string[];

    failures: FailureRecord[];

    last_error: string | null;
}

export interface FailureRecord {
    step_id: string;
    error: string;
    timestamp: string;
}

// ---------- Strategy Store ----------

export interface StrategyStore {
    [platform: string]: {
        [task: string]: Strategy;
    };
}