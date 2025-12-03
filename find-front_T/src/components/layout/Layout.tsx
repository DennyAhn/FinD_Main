import { ReactNode } from 'react'
import Sidebar from './Sidebar'
import TopNav from './TopNav'
import AISidebar from './AISidebar'
import './Layout.css'

interface LayoutProps {
  children: ReactNode
}

export default function Layout({ children }: LayoutProps) {
  return (
    <div className="layout">
      <Sidebar />
      <div className="layout-main">
        <TopNav />
        <div className="layout-content-wrapper">
          <main className="layout-content">{children}</main>
        </div>
      </div>
      <AISidebar />
    </div>
  )
}

