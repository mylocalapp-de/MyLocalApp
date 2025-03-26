# Supabase Setup for MyLocalApp

This directory contains all the necessary files to set up and configure your Supabase instance for MyLocalApp.

## Database Structure

The application uses the following database structure:

- **profiles**: Extends the default Supabase auth.users table
  - `id`: UUID (references auth.users)
  - `username`: Text
  - `avatar_url`: Text
  - `updated_at`: Timestamp
  - `created_at`: Timestamp

- **user_preferences**: Stores user content preferences
  - `id`: UUID (primary key)
  - `user_id`: UUID (references auth.users)
  - `preference_key`: Text (e.g. 'kultur', 'sport', 'verkehr', 'politik')
  - `created_at`: Timestamp

## Setup Instructions

### Option 1: Using the Supabase Dashboard

1. Create a new project in Supabase
2. Go to the SQL Editor
3. Copy the contents of `init.sql` and run it

### Option 2: Using Migrations

If you're using a CI/CD process or want a more structured approach:

1. Execute each migration file in the `migration` directory in order:
```bash
# Example for the first migration
psql -h your-supabase-db-host -d postgres -U postgres -f ./migration/001_initial_setup.sql
```

## Environment Configuration

After setting up your Supabase project, you need to configure your app to use it:

1. Copy your project URL and anon key from the Supabase dashboard (API section)
2. Create a `.env` file in the root directory of your app with the following content:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

## Authentication Configuration

By default, Supabase enables email/password authentication. For production, you might want to:

1. Enable email confirmations in the Auth settings
2. Set up password policies
3. Configure custom email templates for verification, password reset, etc.

## Row Level Security

The database is set up with Row Level Security to ensure:

- Users can only view and update their own profiles
- Users can only access their own preferences
- The trigger system automatically creates a profile entry when a user signs up

## Related Components

The following application components interact with this database setup:

- `src/context/AuthContext.js`: Manages authentication state and Supabase connection
- `src/screens/WelcomeScreen.js`: Handles onboarding and initial preference selection
- `src/screens/ProfileScreen.js`: Provides account management UI 