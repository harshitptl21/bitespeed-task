# Bitespeed Identity Reconciliation

A Node.js application that consolidates customer identities across multiple touchpoints by linking contacts based on email addresses and phone numbers.

[Task Details](https://bitespeed.notion.site/Bitespeed-Backend-Task-Identity-Reconciliation-53392ab01fe149fab989422300423199)

[Deployed Solution]()

## Features

- **Identity Consolidation**: Automatically links contacts with shared email addresses or phone numbers
- **Primary Contact Management**: Maintains a single primary contact per identity group
- **Secondary Contact Linking**: Creates hierarchical relationships between related contacts
- **Contact Deduplication**: Prevents duplicate contacts and merges existing ones
- **RESTful API**: Simple `/identify` endpoint for contact reconciliation

## Tech Stack

- **Node.js** - Runtime environment
- **TypeScript** - Type-safe JavaScript
- **Express.js** - Web framework
- **Prisma** - Database ORM
- **SQLite** - Database (easily replaceable with PostgreSQL/MySQL)

## Project Structure

```
bitespeed-task/
├── prisma/
│   ├── dev.db                    # SQLite database
│   ├── migrations/               # Database migrations
│   └── schema.prisma            # Database schema
├── src/
│   ├── controllers/
│   │   └── contactController.ts # Request handlers
│   ├── services/
│   │   └── contactService.ts    # Business logic
│   ├── routes/
│   │   └── contactRoutes.ts     # Route definitions
│   ├── utils/
│   │   └── prismaClient.ts      # Database client
│   ├── app.ts                   # Express app setup
│   └── server.ts                # Server entry point
├── .env                         # Environment variables
├── package.json                 # Dependencies
└── tsconfig.json               # TypeScript config
```

## Business Logic

### Contact Linking Rules

1. **New Contact**: If no existing contact matches the provided email or phone number, create a new primary contact.

2. **Single Match**: If one existing contact matches, either:
   - Link as secondary if it's a different combination of email/phone
   - Return existing contact if it's an exact match

3. **Multiple Matches**: If multiple contacts match:
   - Find all related primary contacts
   - Keep the oldest primary contact
   - Convert newer primary contacts to secondary
   - Link all related contacts to the oldest primary

4. **Contact Precedence**: 
   - Primary contacts are independent entities
   - Secondary contacts are always linked to a primary contact
   - The oldest contact takes precedence when merging
