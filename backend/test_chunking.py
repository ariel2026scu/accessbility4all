#!/usr/bin/env python3
"""
Test script to demonstrate text chunking functionality.
Run with: python test_chunking.py
"""

from services.text_chunker import TextChunker

def test_chunking():
    """Test the text chunking logic."""
    chunker = TextChunker()

    # Test 1: Short text (should not be chunked)
    short_text = "This is a simple legal contract."
    chunks = chunker.chunk_text(short_text)
    print(f"Test 1 - Short text:")
    print(f"  Input length: {len(short_text)}")
    print(f"  Chunks: {len(chunks)}")
    print(f"  Result: {'✓ PASS' if len(chunks) == 1 else '✗ FAIL'}\n")

    # Test 2: Multi-paragraph text
    multi_para = """This is the first paragraph of a legal document. It contains important information about the agreement between parties.

This is the second paragraph. It outlines the terms and conditions that both parties must abide by. The terms are comprehensive and cover all aspects of the agreement.

This is the third paragraph. It discusses the obligations of each party and what happens if either party breaches the agreement. Breach of contract can result in legal consequences."""

    chunks = chunker.chunk_text(multi_para)
    print(f"Test 2 - Multi-paragraph text:")
    print(f"  Input length: {len(multi_para)}")
    print(f"  Chunks: {len(chunks)}")
    for i, chunk in enumerate(chunks, 1):
        print(f"  Chunk {i}: {len(chunk)} chars - {chunk[:50]}...")
    print(f"  Result: {'✓ PASS' if len(chunks) >= 1 else '✗ FAIL'}\n")

    # Test 3: Long legal text (should be chunked)
    long_text = """WHEREAS, the Lessor and Lessee desire to enter into this Lease Agreement to establish the terms and conditions of the rental of the Property. The Property shall be used solely for residential purposes and in compliance with all federal, state, and local laws and regulations.

The Lessee shall pay monthly rent in the amount specified in the Schedule of Payments, due on the first day of each calendar month. Failure to pay rent on time shall result in late fees as specified herein. The Lessor reserves the right to pursue legal action for non-payment.

The Lessee is responsible for maintaining the Property in good condition and performing routine maintenance tasks. Any major repairs or damages must be reported to the Lessor immediately. The Lessee shall not make any alterations to the Property without written consent.

The Lessor is responsible for maintaining the structural integrity of the building and providing essential services including water, electricity, and heat during the heating season. The Lessor shall conduct necessary repairs to ensure the Property remains habitable and safe.

This Lease Agreement shall commence on the date specified in the schedule and shall continue for the term specified unless terminated earlier by either party in accordance with the provisions herein. Either party may terminate this agreement with ninety days written notice."""

    chunks = chunker.chunk_text(long_text)
    print(f"Test 3 - Long legal text:")
    print(f"  Input length: {len(long_text)}")
    print(f"  Max chunk size: {chunker.max_chunk_size}")
    print(f"  Chunks: {len(chunks)}")
    for i, chunk in enumerate(chunks, 1):
        print(f"  Chunk {i}: {len(chunk)} chars")

    # Verify all chunks are within max size
    all_within_limit = all(len(chunk) <= chunker.max_chunk_size for chunk in chunks)
    print(f"  All chunks within limit: {'✓ PASS' if all_within_limit else '✗ FAIL'}\n")

    # Test 4: Merge functionality
    test_chunks = ["Hello world.", "This is chunk two.", "And this is chunk three."]
    merged = chunker.merge_chunks(test_chunks)
    print(f"Test 4 - Merging chunks:")
    print(f"  Input chunks: {len(test_chunks)}")
    print(f"  Merged result: {merged}")
    print(f"  Result: {'✓ PASS' if len(merged) > 0 else '✗ FAIL'}\n")

if __name__ == "__main__":
    test_chunking()
