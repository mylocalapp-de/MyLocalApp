-- Migration: Create article_attachments table for file attachments support
-- Date: 2024-12-12

-- Create the article_attachments table
CREATE TABLE public.article_attachments (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
    file_url text NOT NULL,
    file_name text NOT NULL,
    file_size bigint,
    mime_type text,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- Add comment for documentation
COMMENT ON TABLE public.article_attachments IS 'Stores file attachments per article (PDFs, documents, etc.)';

-- Index for faster lookups by article_id
CREATE INDEX idx_article_attachments_article_id ON public.article_attachments(article_id);

-- Enable Row Level Security
ALTER TABLE public.article_attachments ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can view article attachments
CREATE POLICY "Anyone can view article attachments"
    ON public.article_attachments 
    FOR SELECT 
    USING (true);

-- RLS Policy: Authenticated users can insert attachments
CREATE POLICY "Authenticated users can insert attachments"
    ON public.article_attachments 
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- RLS Policy: Users can delete their own article attachments (author or org member)
CREATE POLICY "Users can delete their article attachments"
    ON public.article_attachments 
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.articles a
            WHERE a.id = article_attachments.article_id
            AND (
                a.author_id = auth.uid() 
                OR EXISTS (
                    SELECT 1 FROM public.organization_members om
                    WHERE om.organization_id = a.organization_id
                    AND om.user_id = auth.uid()
                )
            )
        )
    );

-- Grant permissions to roles
GRANT SELECT ON public.article_attachments TO anon;
GRANT SELECT, INSERT, DELETE ON public.article_attachments TO authenticated;
