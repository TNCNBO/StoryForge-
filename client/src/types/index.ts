export interface User {
  id: string
  username: string
  email: string
}

export interface Project {
  id: string
  name: string
  description?: string
  userId: string
  createdAt: string
  updatedAt: string
}

export interface Novel {
  id: string
  title: string
  genre?: string
  synopsis?: string
  projectId: string
  createdAt: string
  updatedAt: string
}

export interface Character {
  id: string
  name: string
  description?: string
  personality?: string
  appearance?: string
  background?: string
  novelId: string
  createdAt: string
  updatedAt: string
}

export interface Chapter {
  id: string
  title: string
  content: string
  order: number
  wordCount: number
  status: 'draft' | 'published' | 'archived'
  novelId: string
  createdAt: string
  updatedAt: string
}

export interface AuthResponse {
  token: string
  user: User
}

export interface ApiError {
  message: string
  statusCode: number
}
