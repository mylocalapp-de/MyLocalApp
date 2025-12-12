-- Migration: Create article_images table for multi-image support
-- Date: 2024-12-12

-- Create the article_images table
CREATE TABLE public.article_images (
    id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
    article_id uuid NOT NULL REFERENCES public.articles(id) ON DELETE CASCADE,
    image_url text NOT NULL,
    display_order integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);

-- Add comment for documentation
COMMENT ON TABLE public.article_images IS 'Stores multiple images per article. The first image (display_order=0) is typically used as cover.';

-- Index for faster lookups by article_id
CREATE INDEX idx_article_images_article_id ON public.article_images(article_id);

-- Enable Row Level Security
ALTER TABLE public.article_images ENABLE ROW LEVEL SECURITY;

-- RLS Policy: Anyone can view article images
CREATE POLICY "Anyone can view article images"
    ON public.article_images 
    FOR SELECT 
    USING (true);

-- RLS Policy: Authenticated users can insert images
CREATE POLICY "Authenticated users can insert images"
    ON public.article_images 
    FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- RLS Policy: Users can delete their own article images (author or org member)
CREATE POLICY "Users can delete their article images"
    ON public.article_images 
    FOR DELETE
    USING (
        EXISTS (
            SELECT 1 FROM public.articles a
            WHERE a.id = article_images.article_id
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
GRANT SELECT ON public.article_images TO anon;
GRANT SELECT, INSERT, DELETE ON public.article_images TO authenticated;
