# Drizzle Schema Visualizer

A web application that converts Drizzle ORM schema code into interactive visual diagrams. Built with Next.js, React Flow, and TypeScript.

## Features

### Core Functionality

- **Schema Parsing**: Parses TypeScript/JavaScript Drizzle ORM code
- **Interactive Visualization**: Drag-and-drop table nodes with relationship mapping
- **Code Editor**: Syntax-highlighted editor with schema validation
- **Relationship Detection**: Identifies and visualizes foreign key relationships

### User Interface

- **Responsive Design**: Works on desktop and mobile devices
- **Dark/Light Mode**: Theme switching with system preference detection
- **Resizable Panels**: Adjustable input panel that can be hidden

### Visualization

- **MiniMap**: Overview navigation
- **Zoom Controls**: Zoom and pan functionality
- **Relationship Lines**: Visual connections between related tables
- **Local Storage**: Saves your work automatically

## Installation

### Prerequisites

- **Node.js** 18.0 or higher
- **npm**, **yarn**, **pnpm**, or **bun**

### Installation

1. **Clone the repository**

   ```bash
   git clone https://github.com/yourusername/drizzle-schema-visualizer.git
   cd drizzle-schema-visualizer
   ```

2. **Install dependencies**

   ```bash
   npm install
   # or
   yarn install
   # or
   pnpm install
   ```

3. **Start the development server**

   ```bash
   npm run dev
   # or
   yarn dev
   # or
   pnpm dev
   ```

4. **Open your browser**

   Navigate to [http://localhost:3000](http://localhost:3000)

## 📖 Usage

### Basic Example

1. **Navigate to the visualizer** at `/visualizer`
2. **Paste your Drizzle schema** in the input panel:

```typescript
import {
  pgTable,
  serial,
  varchar,
  integer,
  timestamp,
} from "drizzle-orm/pg-core";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: varchar("name", { length: 256 }),
  email: varchar("email").unique(),
  createdAt: timestamp("created_at").defaultNow(),
});

export const posts = pgTable("posts", {
  id: serial("id").primaryKey(),
  title: varchar("title", { length: 256 }),
  content: varchar("content"),
  authorId: integer("author_id").references(() => users.id),
  createdAt: timestamp("created_at").defaultNow(),
});
```

3. **View the diagram** that generates from your schema code.

### Supported Schema Elements

- Table definitions (`pgTable`, `mysqlTable`, `sqliteTable`)
- Column types (serial, varchar, integer, timestamp, etc.)
- Primary keys and constraints
- Foreign key relationships
- Unique constraints
- Default values
- Enum definitions

### Controls

- Drag tables to reorganize layout
- Zoom and pan to navigate
- Use minimap for overview
- Toggle dark/light mode
- Resize or hide input panel

## Tech Stack

### Frontend

- [Next.js 15](https://nextjs.org/) - React framework
- [React 19](https://reactjs.org/) - UI library
- [TypeScript](https://www.typescriptlang.org/) - Type safety
- [Tailwind CSS 4](https://tailwindcss.com/) - Styling
- [React Flow](https://reactflow.dev/) - Interactive diagrams

### Parsing

- [Acorn](https://github.com/acornjs/acorn) - JavaScript/TypeScript parser
- [Acorn TypeScript](https://github.com/acornjs/acorn-typescript) - TypeScript support
- Custom AST analysis for Drizzle ORM patterns

### UI Components

- [Radix UI](https://www.radix-ui.com/) - Accessible components
- [Lucide React](https://lucide.dev/) - Icons
- [React Resizable Panels](https://github.com/bvaughn/react-resizable-panels) - Resizable layouts
- [Prism.js](https://prismjs.com/) - Syntax highlighting

### State Management

- [Zustand](https://github.com/pmndrs/zustand) - State management
- Local Storage - Data persistence

## Development

### Project Structure

```
src/
├── app/                    # Next.js app router
├── components/             # React components
│   ├── drizzle-flow/      # Visualization components
│   ├── schema-visualizer/ # Input and control components
│   └── ui/                # Reusable UI components
├── lib/                   # Utility functions
│   ├── drizzle-parser.ts  # Schema parsing logic
│   └── drizzle-utils.ts   # Helper utilities
└── types/                 # TypeScript type definitions
```
