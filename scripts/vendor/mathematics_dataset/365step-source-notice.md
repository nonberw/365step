# Vendored upstream source

Source: https://github.com/google-deepmind/mathematics_dataset

Archive: https://codeload.github.com/google-deepmind/mathematics_dataset/zip/refs/heads/master

Archive SHA-256: `9e3cd0ddaed2e363a0162ec5bbbd26dc07b0834c53d3f1e27f48b7659ef6e49a` (downloaded 2026-11-03).

The original Apache-2.0 LICENSE and upstream file notices are preserved. The
vendored Python source is unchanged; upstream tests, package caches and build
metadata are omitted. 365step's separate wrapper samples only algebra/functions,
adapts selected prompts into numeric SAT-style questions and adds Russian
solutions. No upstream difficulty label is treated as a calibrated SAT level.
Offline seed: 36520261103. NumPy seed uses that integer modulo 2**32.

This code runs only during content preparation. The site uses static question
data, requires no Python at runtime and calls no external content API.
