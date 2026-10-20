-- Match knowledge chunks using hybrid vector + full-text RAG search function
SELECT
    chunk_id,
    document_id,
    document_title,
    source_type,
    chunk_index,
    content,
    locale,
    similarity,
    combined_score
FROM public.match_knowledge_chunks(
    $1,
    $2::extensions.vector,
    $3,
    $4,
    $5
);
