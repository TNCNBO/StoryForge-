import dotenv from 'dotenv'

dotenv.config()

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY || ''
const DEEPSEEK_API_URL = process.env.DEEPSEEK_API_URL || 'https://api.deepseek.com/v1'
const MODEL_NAME = process.env.MODEL_NAME || 'deepseek-chat'

interface ChatMessage {
  role: 'user' | 'assistant' | 'system'
  content: string
}

interface ChatOptions {
  temperature?: number
  max_tokens?: number
}

export class DeepSeekClient {
  private apiKey: string
  private apiUrl: string
  private model: string
  private timeout: number

  constructor(apiKey?: string, timeout: number = 120000) {
    this.apiKey = apiKey || DEEPSEEK_API_KEY
    this.apiUrl = DEEPSEEK_API_URL
    this.model = MODEL_NAME
    this.timeout = timeout
  }

  async chat(messages: ChatMessage[], options: ChatOptions = {}): Promise<string> {
    const { temperature = 0.7, max_tokens = 8192 } = options

    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), this.timeout)

    try {
      const response = await fetch(`${this.apiUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: this.model,
          messages,
          temperature,
          max_tokens,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      if (!response.ok) {
        const error = await response.text()
        throw new Error(`DeepSeek API error: ${response.status} - ${error}`)
      }

      const data = await response.json()
      return data.choices[0].message.content
    } catch (error) {
      clearTimeout(timeoutId)
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`DeepSeek API timeout after ${this.timeout}ms`)
      }
      throw error
    }
  }
}

export const deepseekClient = new DeepSeekClient()
