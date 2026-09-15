insert into platforms (
    code,
    name,
    max_length,
    tone,
    max_hashtags,
    adapter
)
values
    (
        'telegram',
        'Telegram',
        4096,
        'informative and conversational',
        5,
        'telegram'
    ),
    (
        'mock_x',
        'X',
        280,
        'concise and engaging',
        3,
        'mock_x'
    ),
    (
        'mock_linkedin',
        'LinkedIn',
        3000,
        'professional and informative',
        5,
        'mock_linkedin'
    );