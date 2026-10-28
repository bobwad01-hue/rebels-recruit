import './globals.css'
import './polish.css'
import DataChangeSync from '@/components/DataChangeSync'
import EventLinkNormalizer from '@/components/EventLinkNormalizer'
import NavigationEnhancer from '@/components/NavigationEnhancer'
import NetworkStatus from '@/components/NetworkStatus'
import ProductionErrorMonitor from '@/components/ProductionErrorMonitor'
import SuccessFeedback from '@/components/SuccessFeedback'
import WebVitalsMonitor from '@/components/WebVitalsMonitor'
import PlatformActivityTracker from '@/components/PlatformActivityTracker'
export const metadata={title:'RLTNL Recruiting',description:'Recruiting happens in the follow-through.',manifest:'/manifest.webmanifest',icons:{icon:'/RLTNL%20Favicon.png',shortcut:'/RLTNL%20Favicon.png',apple:'/RLTNL%20Apple%20Touch%20Icon.png'}}
export const viewport={themeColor:'#111827'}
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body><PlatformActivityTracker/><ProductionErrorMonitor/><WebVitalsMonitor/><NetworkStatus/><SuccessFeedback/><DataChangeSync/><EventLinkNormalizer/><NavigationEnhancer/>{children}</body></html>}
