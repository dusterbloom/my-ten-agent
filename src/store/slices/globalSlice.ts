import { createSlice, PayloadAction } from '@reduxjs/toolkit'

export enum EMobileActiveTab {
  AGENT = "agent",
  CHAT = "chat",
}

export enum EMessageType {
  USER = "user",
  AGENT = "agent",
  SYSTEM = "system",
}

export enum EMessageDataType {
  TEXT = "text",
  AUDIO = "audio",
  VIDEO = "video",
}

export interface IChatItem {
  userId: string
  userName: string
  text: string
  type: EMessageType
  data_type: EMessageDataType
  time: number
}

export interface IOptions {
  channel: string
  userName: string
  userId: number
  appId: string
  token: string
}

interface GlobalState {
  options: IOptions
  chatItems: IChatItem[]
  mobileActiveTab: EMobileActiveTab
  connected: boolean
  connecting: boolean
  localMicOn: boolean
  localCameraOn: boolean
  remoteUserConnected: boolean
  currentLanguage: string
  currentVoice: string
  currentGraph: string
}

const initialState: GlobalState = {
  options: {
    channel: "",
    userName: "",
    userId: 0,
    appId: "",
    token: "",
  },
  chatItems: [],
  mobileActiveTab: EMobileActiveTab.AGENT,
  connected: false,
  connecting: false,
  localMicOn: false,
  localCameraOn: false,
  remoteUserConnected: false,
  currentLanguage: "en-US",
  currentVoice: "female",
  currentGraph: "va_openai_azure",
}

const globalSlice = createSlice({
  name: 'global',
  initialState,
  reducers: {
    setOptions: (state, action: PayloadAction<Partial<IOptions>>) => {
      state.options = { ...state.options, ...action.payload }
    },
    addChatItem: (state, action: PayloadAction<IChatItem>) => {
      state.chatItems.push(action.payload)
    },
    clearChatItems: (state) => {
      state.chatItems = []
    },
    setMobileActiveTab: (state, action: PayloadAction<EMobileActiveTab>) => {
      state.mobileActiveTab = action.payload
    },
    setConnected: (state, action: PayloadAction<boolean>) => {
      state.connected = action.payload
    },
    setConnecting: (state, action: PayloadAction<boolean>) => {
      state.connecting = action.payload
    },
    setLocalMicOn: (state, action: PayloadAction<boolean>) => {
      state.localMicOn = action.payload
    },
    setLocalCameraOn: (state, action: PayloadAction<boolean>) => {
      state.localCameraOn = action.payload
    },
    setRemoteUserConnected: (state, action: PayloadAction<boolean>) => {
      state.remoteUserConnected = action.payload
    },
    setCurrentLanguage: (state, action: PayloadAction<string>) => {
      state.currentLanguage = action.payload
    },
    setCurrentVoice: (state, action: PayloadAction<string>) => {
      state.currentVoice = action.payload
    },
    setCurrentGraph: (state, action: PayloadAction<string>) => {
      state.currentGraph = action.payload
    },
  },
})

export const {
  setOptions,
  addChatItem,
  clearChatItems,
  setMobileActiveTab,
  setConnected,
  setConnecting,
  setLocalMicOn,
  setLocalCameraOn,
  setRemoteUserConnected,
  setCurrentLanguage,
  setCurrentVoice,
  setCurrentGraph,
} = globalSlice.actions

export default globalSlice.reducer