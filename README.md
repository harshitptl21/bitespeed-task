# Bitespeed Identity Reconciliation

A Node.js application that consolidates customer identities across multiple touchpoints by linking contacts based on email addresses and phone numbers.

[Task Details](https://bitespeed.notion.site/Bitespeed-Backend-Task-Identity-Reconciliation-53392ab01fe149fab989422300423199)

[Deployed Solution](https://bitespeed-task-785u.onrender.com/identify)

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

## Installation

### Prerequisites

- Node.js (v16 or higher)
- npm or yarn

### Setup

1. **Clone the project repo**
   ```bash
   git clone https://github.com/harshitptl21/bitespeed-task/
   cd bitespeed-task
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up the database**
   ```bash
   # Create and apply migrations
   npx prisma migrate dev --name init
   
   # Generate Prisma client
   npx prisma generate
   ```

4. **Build the project**
   ```bash
   npm run build
   ```

## Usage

### Development Mode

Start the server with auto-reload:

```bash
npm run dev
```

### Production Mode

Build and start the server:

```bash
npm run build
npm start
```

The server will run on `http://localhost:3000` by default.

## API Reference

### POST `/identify`

Identifies and consolidates customer contacts based on email and/or phone number.

#### Request Body

```json
{
  "email": "customer@example.com",
  "phoneNumber": "1234567890"
}
```

**Note**: At least one of `email` or `phoneNumber` must be provided.

#### Response

```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["customer@example.com", "customer.alt@example.com"],
    "phoneNumbers": ["1234567890", "0987654321"],
    "secondaryContactIds": [2, 3]
  }
}
```

#### Example Scenarios

**Scenario 1: New Contact**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "mcfly@hillvalley.edu", "phoneNumber": "123456"}'
```

**Scenario 2: Linking Existing Contacts**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "mcfly@hillvalley.edu", "phoneNumber": "654321"}'
```

**Scenario 3: Email Only**
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "lorraine@hillvalley.edu"}'
```

## Database Schema

The application uses a single `Contact` table with the following structure:

| Field | Type | Description |
|-------|------|-------------|
| `id` | Int | Primary key (auto-increment) |
| `phoneNumber` | String? | Phone number (optional) |
| `email` | String? | Email address (optional) |
| `linkedId` | Int? | Reference to primary contact ID |
| `linkPrecedence` | Enum | "primary" or "secondary" |
| `createdAt` | DateTime | Creation timestamp |
| `updatedAt` | DateTime | Last update timestamp |
| `deletedAt` | DateTime? | Soft deletion timestamp |

## Scripts

Available npm scripts:

```bash
npm run build          # Compile TypeScript to JavaScript
npm run start          # Start the production server
npm run dev            # Start development server with auto-reload
npm run prisma:generate # Generate Prisma client
npm run prisma:migrate  # Run database migrations
npm run prisma:studio   # Open Prisma Studio (database GUI)
```

## Database Management

### View Database

Open Prisma Studio to view and edit data:

```bash
npm run prisma:studio
```

### Reset Database

To reset the database and start fresh:

```bash
npx prisma migrate reset
```

### Change Database Provider

To switch from SQLite to PostgreSQL or MySQL:

1. Update `datasource` in `prisma/schema.prisma`
2. Update `DATABASE_URL` in `.env`
3. Run `npx prisma migrate dev`

## Environment Variables

Create a `.env` file in the project root:

```env
# Database
DATABASE_URL="file:./dev.db"

# Server (optional)
PORT=3000
```

## Error Handling

The API includes comprehensive error handling:

- **400 Bad Request**: When neither email nor phone number is provided
- **500 Internal Server Error**: For database errors or unexpected issues
- Detailed error messages in development mode
- Graceful error responses in production

## Testing

You can test the API using various tools:

### Using curl
```bash
curl -X POST http://localhost:3000/identify \
  -H "Content-Type: application/json" \
  -d '{"email": "test@example.com", "phoneNumber": "1234567890"}'
```

### Using Postman
1. Create a new POST request
2. Set URL to `http://localhost:3000/identify`
3. Set Content-Type to `application/json`
4. Add request body with email and/or phoneNumber

## Troubleshooting

### Common Issues

1. **Database Connection Error**
   - Verify `DATABASE_URL` in `.env`
   - Ensure database exists and is accessible
   - Run `npx prisma generate`

2. **TypeScript Compilation Error**
   - Check `tsconfig.json` configuration
   - Verify all dependencies are installed
   - Run `npm run build` to see detailed errors

3. **Port Already in Use**
   - Change the `PORT` environment variable
   - Kill existing processes using the port

### Debug Mode

Enable debug logging:

```bash
DEBUG=* npm run dev
```
