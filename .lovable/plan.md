

# Reply Threading for Comments

## Overview
Add the ability to reply to specific comments, creating a threaded conversation view within each prediction's comment section.

## Database Change
Add a `parent_id` column to the `comments` table (nullable UUID, self-referencing) to link replies to parent comments.

**Migration SQL:**
```sql
ALTER TABLE public.comments ADD COLUMN parent_id uuid DEFAULT NULL;
```

## Backend Changes

### 1. `add-comment` Edge Function
- Accept an optional `parent_id` field in the request body
- Validate that the parent comment exists and belongs to the same prediction
- Include `parent_id` in the insert statement

## Frontend Changes

### 2. `CommentsSection.tsx`
- Update the `Comment` interface to include `parent_id` and `replies` array
- Fetch `parent_id` alongside other comment fields
- Build a tree structure: group top-level comments (no parent_id) with their replies nested underneath
- Add a "Reply" button on each comment that sets a `replyingTo` state
- When replying, show the parent comment's author name as context (e.g., "Replying to @user...")
- Pass `parent_id` to the `add-comment` invocation when replying
- Render replies indented under their parent with a left border for visual hierarchy
- Limit nesting to 1 level (replies to replies attach to the same parent) to keep mobile UI clean
- On mobile, delete button uses tap (already works via group-hover fallback)

## Technical Details
- No new Edge Function needed; `add-comment` is extended with one optional field
- Comments query already orders by `created_at` ascending, which works for threading
- Tree building happens client-side after fetching flat comment list
- Single-level nesting keeps the UI simple on the 420px mobile viewport

