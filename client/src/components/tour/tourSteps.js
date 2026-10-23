/**
 * Configurable Guided Tour Steps for Dynease Restaurant Platform
 * Uses stable [data-tour="..."] selectors to target elements cleanly.
 */

export const TOUR_STEPS = [
  {
    target: '[data-tour="welcome"]',
    title: 'Welcome to Dynease',
    content: 'Dynease is an all-in-one restaurant QR ordering and digital management platform. As a visitor, you can explore the entire management experience right here without creating an account or altering live operations.',
    placement: 'bottom',
    disableBeacon: true,
    data: { tab: 'dashboard' },
  },
  {
    target: '[data-tour="dashboard"]',
    title: 'Smart Restaurant Dashboard',
    content: 'Monitor today’s orders, net revenue, active table occupancy, and kitchen turnaround time in one unified command center designed for restaurant owners and managers.',
    placement: 'bottom',
    disableBeacon: true,
    data: { tab: 'dashboard' },
  },
  {
    target: '[data-tour="orders"]',
    title: 'Real-Time Live Orders',
    content: 'Incoming customer orders placed from table QR codes appear instantly. Filter orders by status, view detailed item modifications, and track delivery from table to kitchen.',
    placement: 'bottom',
    disableBeacon: true,
    data: { tab: 'orders' },
  },
  {
    target: '[data-tour="menu"]',
    title: 'Digital Menu Management',
    content: 'Effortlessly curate food items, categories, pricing, dietary preferences (Veg, Non-Veg), and real-time 86/availability toggles that sync instantly to customer phones.',
    placement: 'bottom',
    disableBeacon: true,
    data: { tab: 'menu' },
  },
  {
    target: '[data-tour="tables"]',
    title: 'Tables & Dynamic QR Codes',
    content: 'Configure dining areas and table capacities. Each table generates a unique, contactless QR code ready for download, high-resolution printing, and direct guest ordering.',
    placement: 'bottom',
    disableBeacon: true,
    data: { tab: 'tables' },
  },
  {
    target: '[data-tour="kitchen"]',
    title: 'Kitchen Display System (KDS)',
    content: 'Empower kitchen chefs and prep staff with live ticket queues, preparation timers, special preparation notes, and single-tap order status updates.',
    placement: 'bottom',
    disableBeacon: true,
    data: { tab: 'kitchen' },
  },
  {
    target: '[data-tour="analytics"]',
    title: 'Operational & Sales Analytics',
    content: 'Gain deep business intelligence: track peak ordering hours, top-selling dishes, category revenue contributions, and customer retention metrics.',
    placement: 'bottom',
    disableBeacon: true,
    data: { tab: 'analytics' },
  },
  {
    target: '[data-tour="get-started"]',
    title: 'Ready to Transform Your Restaurant?',
    content: 'Experience faster table turnover, higher average order value, and delighted diners. Register your restaurant today to start your free 14-day trial—no credit card required.',
    placement: 'top',
    disableBeacon: true,
    data: { tab: 'dashboard' },
  },
];
