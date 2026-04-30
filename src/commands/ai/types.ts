export interface IOpenAIUsage {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
}

export interface IOpenAIMessage {
    role: string;
    content: string;
}

export interface IOpenAIChoice {
    index: number;
    message: IOpenAIMessage;
    finish_reason: string;
}

export interface IOpenAIResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: IOpenAIChoice[];
    usage: IOpenAIUsage;
}
