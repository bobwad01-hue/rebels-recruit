import './globals.css'
import EventLinkNormalizer from '@/components/EventLinkNormalizer'
import NavigationEnhancer from '@/components/NavigationEnhancer'
export const metadata={title:'Rebels Recruit',description:'Your recruiting. Your relationships. Your journey.',manifest:'/manifest.webmanifest',icons:{icon:'/icon.svg',shortcut:'/icon.svg',apple:'/apple-touch-icon.png'}}
export const viewport={themeColor:'#111827'}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><EventLinkNormalizer/><NavigationEnhancer/>{children}</body></html>}
