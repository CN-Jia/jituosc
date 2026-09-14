// 毕设进度查询结果 store（供查询页写入、结果页读取）

import { defineStore } from 'pinia'

export interface ThesisProjectInfo {
  title: string
  studentName: string
  studentNo?: string
  advisor?: string
  major?: string
}

export interface ThesisProgressImage {
  id: number
  url: string
  filename?: string
}

export interface ThesisProgressItem {
  id: number
  title: string
  percent: number
  content?: string
  createdAt: string
  images: ThesisProgressImage[]
}

export interface ThesisQueryResult {
  project: ThesisProjectInfo
  currentPercent: number
  progresses: ThesisProgressItem[]
}

export const useThesisStore = defineStore('thesis', {
  state: (): ThesisQueryResult => ({
    project: { title: '', studentName: '', studentNo: '', advisor: '', major: '' },
    currentPercent: 0,
    progresses: [],
  }),
  actions: {
    setResult(result: ThesisQueryResult) {
      this.project = result.project
      this.currentPercent = result.currentPercent
      this.progresses = result.progresses
    },
    clear() {
      this.project = { title: '', studentName: '', studentNo: '', advisor: '', major: '' }
      this.currentPercent = 0
      this.progresses = []
    },
  },
})
