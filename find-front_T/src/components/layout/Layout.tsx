import { ReactNode } from 'react'
import Sidebar from './Sidebar'
import TopNav from './TopNav'
import AISidebar from './AISidebar'
import { useChatStore } from '@/store/useChatStore'
import './Layout.css'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  const { isOpen: isChatOpen } = useChatStore()
  
  return (
    <div className="layout">
      <Sidebar />
      <div className="layout-main">
        <TopNav />
        <div className="layout-content-wrapper">
          <main className="layout-content">{children}</main>
        </div>
      </div>
      <AISidebar isOpen={isChatOpen} />
    </div>
  )
}

