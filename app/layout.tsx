import './globals.css'
import './polish.css'
import DataChangeSync from '@/components/DataChangeSync'
import EventLinkNormalizer from '@/components/EventLinkNormalizer'
import NavigationEnhancer from '@/components/NavigationEnhancer'
import NetworkStatus from '@/components/NetworkStatus'
import ProductionErrorMonitor from '@/components/ProductionErrorMonitor'
import SuccessFeedback from '@/components/SuccessFeedback'
import WebVitalsMonitor from '@/components/WebVitalsMonitor'
export const metadata={title:'Rebels Recruit',description:'Your recruiting. Your relationships. Your journey.',manifest:'/manifest.webmanifest',icons:{icon:'/icon.svg',shortcut:'/icon.svg',apple:'/apple-touch-icon.png'}}
export const viewport={themeColor:'#111827'}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><ProductionErrorMonitor/><WebVitalsMonitor/><NetworkStatus/><SuccessFeedback/><DataChangeSync/><EventLinkNormalizer/><NavigationEnhancer/>{children}</body></html>}
