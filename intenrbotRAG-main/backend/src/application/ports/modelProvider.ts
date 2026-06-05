export interface ModelUsage {
  inputTokens?: number
  outputTokens?: number
}

export interface GenerateTextRequest {
  systemPrompt: string
  userInput: string
  temperature?: number
  enableGoogleSearch?: boolean
  attachments?: Array<{
    mimeType: string
    dataBase64: string
    fileName?: string
  }>
}

export interface WebSource {
  title: string
  uri: string
}

export interface GenerateTextResponse {
  rawText: string
  usage?: ModelUsage
  webSources?: WebSource[]
}

export interface ModelProvider {
  readonly name: string
  generateText(request: GenerateTextRequest): Promise<GenerateTextResponse>
}
