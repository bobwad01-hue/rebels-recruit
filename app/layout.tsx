import './globals.css'
export const metadata={title:'Rebels Recruit',description:'Your recruiting. Your relationships. Your journey.',manifest:'/manifest.webmanifest'}
export const viewport={themeColor:'#111827'}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body>{children}</body></html>}
