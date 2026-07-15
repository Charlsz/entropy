/**
 * Design system barrel export.
 *
 * Import from this file, not individual modules:
 *   import { Button, Card, Sidebar } from '@/design-system';
 *
 * This keeps imports clean and lets us reorganize internals freely.
 */

export { Button } from './Button';
export { Input } from './Input';
export { Card } from './Card';
export { Panel } from './Panel';
export { Sidebar, SidebarSection, SidebarItem } from './Sidebar';
export { Divider } from './Divider';
export {
  Heading1,
  Heading2,
  Heading3,
  Body,
  Caption,
  Label,
  Code,
} from './Typography';
export * as tokens from './tokens';
