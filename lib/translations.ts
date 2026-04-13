export type Language = "zh-TW" | "en" | "ja"

export const translations = {
  "zh-TW": {
    title: "YouTube 隨機播放器",
    subtitle: "進階播放清單管理與隨機播放",
    buyMeCoffee: "請我喝咖啡！",

    // Playlist Manager
    playlistUrl: "播放清單網址或 ID",
    playlistUrlPlaceholder: "貼上 YouTube 播放清單網址或 ID",
    playlistName: "播放清單名稱（選填）",
    playlistNamePlaceholder: "我的播放清單",
    addPlaylist: "新增播放清單",
    loading: "載入中...",
    myPlaylists: "我的播放清單",
    videos: "個影片",
    deletePlaylist: "刪除播放清單",
    createCompilation: "建立合輯",
    compilationName: "合輯名稱",
    selectPlaylists: "選擇播放清單",
    create: "建立",
    cancel: "取消",

    // Sort modes
    sortOriginal: "原始排序",
    sortRandom: "隨機排序",
    sortNameAsc: "名稱 A-Z",
    sortNameDesc: "名稱 Z-A",
    sortNewest: "最晚新增",
    sortOldest: "最早新增",

    // Play modes
    playNormal: "順序播放",
    playSingleLoop: "單曲循環",

    // Settings
    autoplayNext: "自動播放下一首",

    // Video player
    previous: "上一首",
    next: "下一首",
    currentPlaying: "目前播放",

    // Themes
    themeLight: "明亮模式",
    themeDark: "暗色模式",
    themeThumbnail: "縮圖背景",

    // Languages
    langZhTW: "繁體中文",
    langEn: "English",
    langJa: "日本語",

    // Toast messages
    apiKeyMissing: "API 金鑰未設定",
    apiKeyMissingDesc: "請在環境變數中設定 YOUTUBE_API_KEY",
    loadFailed: "載入失敗",
    loadFailedDesc: "無法載入播放清單，請檢查 ID 是否正確",
    playlistLoaded: "播放清單已載入",
    playlistLoadedDesc: "成功載入 {count} 個影片",
    playlistEmpty: "播放清單為空",
    playlistEmptyDesc: "此播放清單沒有影片",
    networkError: "網路錯誤",
    networkErrorDesc: "無法連接到伺服器，請稍後再試",
    playlistExists: "播放清單已存在",
    playlistExistsDesc: "此播放清單已經在列表中",
    playlistDeleted: "播放清單已刪除",
    playlistDeletedDesc: "播放清單已成功刪除",
    refreshPlaylist: "更新播放清單",
    playlistRefreshed: "播放清單已更新",
    playlistRefreshedDesc: "成功更新為 {count} 個影片",
  },
  en: {
    title: "YouTube Random Player",
    subtitle: "Advanced Playlist Management & Random Playback",
    buyMeCoffee: "Buy me a coffee!",

    // Playlist Manager
    playlistUrl: "Playlist URL or ID",
    playlistUrlPlaceholder: "Paste YouTube playlist URL or ID",
    playlistName: "Playlist Name (Optional)",
    playlistNamePlaceholder: "My Playlist",
    addPlaylist: "Add Playlist",
    loading: "Loading...",
    myPlaylists: "My Playlists",
    videos: "videos",
    deletePlaylist: "Delete Playlist",
    createCompilation: "Create Compilation",
    compilationName: "Compilation Name",
    selectPlaylists: "Select Playlists",
    create: "Create",
    cancel: "Cancel",

    // Sort modes
    sortOriginal: "Original Order",
    sortRandom: "Random",
    sortNameAsc: "Name A-Z",
    sortNameDesc: "Name Z-A",
    sortNewest: "Newest First",
    sortOldest: "Oldest First",

    // Play modes
    playNormal: "Sequential",
    playSingleLoop: "Single Loop",

    // Settings
    autoplayNext: "Autoplay Next",

    // Video player
    previous: "Previous",
    next: "Next",
    currentPlaying: "Now Playing",

    // Themes
    themeLight: "Light Mode",
    themeDark: "Dark Mode",
    themeThumbnail: "Thumbnail Background",

    // Languages
    langZhTW: "繁體中文",
    langEn: "English",
    langJa: "日本語",

    // Toast messages
    apiKeyMissing: "API Key Missing",
    apiKeyMissingDesc: "Please set YOUTUBE_API_KEY in environment variables",
    loadFailed: "Load Failed",
    loadFailedDesc: "Unable to load playlist, please check the ID",
    playlistLoaded: "Playlist Loaded",
    playlistLoadedDesc: "Successfully loaded {count} videos",
    playlistEmpty: "Playlist Empty",
    playlistEmptyDesc: "This playlist has no videos",
    networkError: "Network Error",
    networkErrorDesc: "Unable to connect to server, please try again later",
    playlistExists: "Playlist Already Exists",
    playlistExistsDesc: "This playlist is already in your list",
    playlistDeleted: "Playlist Deleted",
    playlistDeletedDesc: "Playlist has been successfully deleted",
    refreshPlaylist: "Refresh Playlist",
    playlistRefreshed: "Playlist Refreshed",
    playlistRefreshedDesc: "Successfully updated to {count} videos",
  },
  ja: {
    title: "YouTube ランダムプレーヤー",
    subtitle: "高度なプレイリスト管理とランダム再生",
    buyMeCoffee: "コーヒーをおごる！",

    // Playlist Manager
    playlistUrl: "プレイリストURLまたはID",
    playlistUrlPlaceholder: "YouTubeプレイリストのURLまたはIDを貼り付け",
    playlistName: "プレイリスト名（任意）",
    playlistNamePlaceholder: "マイプレイリスト",
    addPlaylist: "プレイリストを追加",
    loading: "読み込み中...",
    myPlaylists: "マイプレイリスト",
    videos: "動画",
    deletePlaylist: "プレイリストを削除",
    createCompilation: "コンピレーションを作成",
    compilationName: "コンピレーション名",
    selectPlaylists: "プレイリストを選択",
    create: "作成",
    cancel: "キャンセル",

    // Sort modes
    sortOriginal: "元の順序",
    sortRandom: "ランダム",
    sortNameAsc: "名前 A-Z",
    sortNameDesc: "名前 Z-A",
    sortNewest: "最新順",
    sortOldest: "最古順",

    // Play modes
    playNormal: "順次再生",
    playSingleLoop: "1曲リピート",

    // Settings
    autoplayNext: "次を自動再生",

    // Video player
    previous: "前へ",
    next: "次へ",
    currentPlaying: "再生中",

    // Themes
    themeLight: "ライトモード",
    themeDark: "ダークモード",
    themeThumbnail: "サムネイル背景",

    // Languages
    langZhTW: "繁體中文",
    langEn: "English",
    langJa: "日本語",

    // Toast messages
    apiKeyMissing: "APIキーが設定されていません",
    apiKeyMissingDesc: "環境変数にYOUTUBE_API_KEYを設定してください",
    loadFailed: "読み込み失敗",
    loadFailedDesc: "プレイリストを読み込めません。IDを確認してください",
    playlistLoaded: "プレイリストを読み込みました",
    playlistLoadedDesc: "{count}個の動画を読み込みました",
    playlistEmpty: "プレイリストが空です",
    playlistEmptyDesc: "このプレイリストには動画がありません",
    networkError: "ネットワークエラー",
    networkErrorDesc: "サーバーに接続できません。後でもう一度お試しください",
    playlistExists: "プレイリストは既に存在します",
    playlistExistsDesc: "このプレイリストは既にリストに含まれています",
    playlistDeleted: "プレイリストを削除しました",
    playlistDeletedDesc: "プレイリストが正常に削除されました",
    refreshPlaylist: "プレイリストを更新",
    playlistRefreshed: "プレイリストを更新しました",
    playlistRefreshedDesc: "{count}個の動画に更新しました",
  },
}

export function useTranslation(language: Language) {
  return translations[language]
}
