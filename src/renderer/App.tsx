import React, { useState } from 'react';
import { AppShell } from './layouts/AppShell';
import {
  Sidebar,
  SidebarSection,
  SidebarItem,
  Panel,
  Card,
  Button,
  Input,
  Heading2,
  Heading3,
  Body,
  Caption,
  Label,
  Divider,
} from './design-system';

/**
 * App.tsx — the first window.
 *
 * This is intentionally a kitchen-sink demo of every design primitive.
 * It will be replaced by real screens as features are built.
 *
 * Why put the demo here instead of a Storybook?
 * Storybook adds overhead we don't need yet. A single demo screen is
 * enough to validate the design system without a build pipeline detour.
 */

const NAV_ITEMS = [
  { id: 'home', label: 'Home' },
  { id: 'notebooks', label: 'Notebooks', badge: 4 },
  { id: 'references', label: 'References' },
  { id: 'tags', label: 'Tags' },
] as const;

type NavId = (typeof NAV_ITEMS)[number]['id'];

export default function App() {
  const [active, setActive] = useState<NavId>('home');
  const [search, setSearch] = useState('');

  return (
    <AppShell
      sidebar={
        <Sidebar>
          <SidebarSection>
            <Input
              placeholder="Search…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              icon={
                <svg width="12" height="12" viewBox="0 0 16 16" fill="none">
                  <circle cx="6.5" cy="6.5" r="5" stroke="currentColor" strokeWidth="1.5" />
                  <path d="M10.5 10.5L14 14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              }
            />
          </SidebarSection>

          <SidebarSection label="Library">
            {NAV_ITEMS.map((item) => (
              <SidebarItem
                key={item.id}
                label={item.label}
                active={active === item.id}
                badge={'badge' in item ? item.badge : undefined}
                onClick={() => setActive(item.id)}
              />
            ))}
          </SidebarSection>

          <Divider />

          <SidebarSection label="Pinned">
            <SidebarItem label="Design Notes" onClick={() => {}} />
            <SidebarItem label="Architecture" onClick={() => {}} />
          </SidebarSection>
        </Sidebar>
      }
    >
      {/* Main content */}
      <div className="flex flex-1 flex-col gap-6 overflow-y-auto p-6">
        <div>
          <Heading2>Design System</Heading2>
          <Body className="mt-1">Every primitive in one place — this screen will become a real view.</Body>
        </div>

        {/* Buttons */}
        <Panel title="Buttons">
          <div className="flex flex-wrap gap-3">
            <Button variant="primary">Primary</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="primary" destructive>Destructive</Button>
            <Button variant="secondary" loading>Loading</Button>
            <Button variant="primary" disabled>Disabled</Button>
            <Button variant="primary" size="sm">Small</Button>
          </div>
        </Panel>

        {/* Typography */}
        <Panel title="Typography">
          <div className="flex flex-col gap-3">
            <Heading2>Heading 2</Heading2>
            <Heading3>Heading 3</Heading3>
            <Body>Body text — calm, legible, and never more prominent than it needs to be.</Body>
            <Caption>Caption — for metadata, timestamps, and secondary context.</Caption>
            <Label>Label — uppercase, small, for section headers</Label>
          </div>
        </Panel>

        {/* Inputs */}
        <Panel title="Inputs">
          <div className="flex flex-col gap-3 max-w-sm">
            <Input placeholder="Default input" />
            <Input placeholder="With error" error="This field is required" />
          </div>
        </Panel>

        {/* Cards */}
        <Panel title="Cards">
          <div className="grid grid-cols-2 gap-3">
            <Card>
              <Heading3>Static Card</Heading3>
              <Body className="mt-1">A non-interactive content container.</Body>
            </Card>
            <Card interactive onClick={() => alert('clicked')}>
              <Heading3>Interactive Card</Heading3>
              <Body className="mt-1">Hover to see the state change.</Body>
            </Card>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
