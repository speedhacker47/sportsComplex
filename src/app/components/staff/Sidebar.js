// src/components/layout/Sidebar.js
'use client';

import Image from "next/image";
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '../../../contexts/AuthContext';
import { useState } from 'react';
import { 
  FiCalendar, 
  FiUsers, 
  FiSettings, 
  FiLogOut, 
  FiChevronDown, 
  FiChevronRight,
  FiMenu,
  FiX,
  FiFileText,
  FiChevronLeft,
  FiUserCheck,
  FiBook,
  FiMessageSquare
} from 'react-icons/fi';


const navLinks = [
  { 
    name: 'Members', 
    href: '/staff/members', 
    icon:  FiUsers,
    description: 'Manage members'
  },
  { 
    name: 'Payments', 
    href: '/staff/payments', 
    icon: FiBook ,
    description: 'Manage staff members'
  },
  { 
    name: 'Academy', 
    href: '/staff/academy', 
    icon: FiBook ,
    description: 'Manage academy subscriptions'
  }
  

  //  { 
  //   name: 'Manage Facility', 
  //   href: '/staff/facilty', 
  //   icon: FiCalendar,
  //   description: 'Manage Facility'
  // }
  // { 
  //   name: 'Reports', 
  //   href: '/staff/reports', 
  //   icon: FiCalendar,
  //   description: 'Analytics & insights'
  // },
  // { 
  //   name: 'Settings', 
  //   href: '/staff/settings', 
  //   icon: FiSettings,
  //   description: 'System preferences'
  // }
];


export default function Sidebar({ isCollapsed = false, onToggle }) {
  const pathname = usePathname();
  const [expandedItems, setExpandedItems] = useState({});
  const { user, signOut } = useAuth();

  const handleLogout = async () => {
    if (confirm('Are you sure you want to logout?')) {
      await signOut();
    }
  };

  const toggleExpanded = (itemName, e) => {
    e.preventDefault();
    e.stopPropagation();
    setExpandedItems(prev => ({ ...prev, [itemName]: !prev[itemName] }));
  };

  const NavItem = ({ link }) => {
    const isActive = pathname.startsWith(link.href);
    const isExpanded = expandedItems[link.name];
    const hasSubLinks = link.subLinks && link.subLinks.length > 0;
    const IconComponent = link.icon;

    return (
      <li>
        <Link 
          href={link.href}
          className={`
            flex items-center w-full px-4 py-3 text-sm font-medium transition-all duration-200 rounded-lg mx-3
            ${isActive 
              ? 'text-brand-primary bg-blue-50' 
              : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
            }
            ${isCollapsed ? 'justify-center px-2' : ''}
          `}
        >
          <IconComponent className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'} flex-shrink-0`} />
          
          {!isCollapsed && (
            <>
              <div className="flex-1">
                <div className="font-medium">{link.name}</div>
                {link.description && <div className="text-xs text-gray-500 mt-0.5">{link.description}</div>}
              </div>
              {hasSubLinks && (
                <button
                  onClick={(e) => toggleExpanded(link.name, e)}
                  className="ml-2 p-1 hover:bg-gray-200 rounded"
                >
                  {isExpanded ? <FiChevronDown className="w-4 h-4 text-gray-400" /> : <FiChevronRight className="w-4 h-4 text-gray-400" />}
                </button>
              )}
            </>
          )}
        </Link>

        {hasSubLinks && isExpanded && !isCollapsed && (
          <ul className="ml-6 mt-1 space-y-1">
            {link.subLinks.map((subLink) => (
              <li key={subLink.name}>
                <Link
                  href={subLink.href}
                  className={`
                    flex items-center px-4 py-2 text-sm rounded-lg mx-3 transition-all duration-200
                    ${pathname === subLink.href
                      ? 'text-brand-primary bg-blue-50 font-medium'
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-100'
                    }
                  `}
                >
                  <span className="w-2 h-2 bg-current rounded-full mr-3 opacity-60"></span>
                  {subLink.name}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </li>
    );
  };

  return (
    <aside className={`
      ${isCollapsed ? 'w-20' : 'w-72'} 
      bg-white border-r border-gray-200
      flex-shrink-0 transition-all duration-300 ease-in-out
      flex flex-col h-full relative z-50
    `}>
      
      {/* Header */}
      <div className={`p-6 border-b border-gray-200 ${isCollapsed ? 'px-4' : ''}`}>
        <div className="flex items-center justify-between">
          {!isCollapsed ? (
            <div className="flex items-center space-x-3">
              <div className="w-15 h-15  rounded-xl flex items-center justify-center">
                <Image
                  src="/logo_sc.webp"
                  alt="Raigarh Logo"
                  width={40}
                  height={40}
                  priority
                />
              </div>
              <div>
                <h1 className="text-xl font-bold text-text-primary">Sports Complex Connnect</h1>
              </div>
            </div>
          ) : (
            <div className="w-10 h-10 bg-gradient-to-br from-brand-primary to-blue-700 rounded-xl flex items-center justify-center mx-auto">
               <Image
                src="/kartavya.webp"
                alt="Kartavya Logo"
                width={40}
                height={40}
                priority
              />
            </div>
          )}
          
          {!isCollapsed && onToggle && (
            <button onClick={onToggle} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
              <FiX className="w-5 h-5" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 py-4 overflow-y-auto overflow-x-hidden">
        <ul className="space-y-1">
          {navLinks.map((link) => <NavItem key={link.name} link={link} />)}
        </ul>
      </nav>

      {/* Bottom Section */}
      <div className="border-t border-gray-200 p-4 space-y-2">
        {/* Feedback Link */}
        <Link 
          href="feedback"
          className={`
            flex items-center w-full px-3 py-2 text-sm font-medium transition-all duration-200 rounded-lg
            ${pathname.startsWith('/feedback')
              ? 'text-brand-primary bg-blue-50' 
              : 'text-gray-700 hover:text-gray-900 hover:bg-gray-100'
            }
            ${isCollapsed ? 'justify-center' : ''}
          `}
        >
          <FiMessageSquare className={`w-5 h-5 ${isCollapsed ? '' : 'mr-3'} flex-shrink-0`} />
          {!isCollapsed && (
            <div className="flex-1">
              <div className="font-medium">Feedback</div>
              <div className="text-xs text-gray-500 mt-0.5">Report issues & suggestions</div>
            </div>
          )}
        </Link>

        {/* Sign Out Button */}
        {!isCollapsed && (
          <button onClick={handleLogout} className="flex items-center w-full px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
            <FiLogOut className="w-5 h-5 mr-3" />
            Sign Out
          </button>
        )}

        {isCollapsed && (
          <button className="flex items-center justify-center w-full px-3 py-2 text-sm text-gray-700 rounded-lg hover:bg-gray-100 transition-colors">
            <FiLogOut className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Toggle Button - Positioned on Right Border */}
      {onToggle && (
        <button
          onClick={onToggle}
          className={`
            absolute right-0 top-1/2 transform translate-x-1/2 -translate-y-1/2
            bg-white border-2 border-gray-200 rounded-full p-2
            hover:bg-gray-50 hover:border-gray-300 transition-all duration-200
            shadow-lg hover:shadow-xl
            flex items-center justify-center
            w-10 h-10
            z-50
          `}
          title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {isCollapsed ? (
            <FiChevronRight className="w-5 h-5 text-gray-600" />
          ) : (
            <FiChevronLeft className="w-5 h-5 text-gray-600" />
          )}
        </button>
      )}
    </aside>
  );
}