from setuptools import setup, find_packages

with open("README.md", "r", encoding="utf-8") as fh:
    long_description = fh.read()

setup(
    name="nwo-text-cad",
    version="0.1.0",
    author="NWO Robotics",
    author_email="ciprian.pater@publicae.org",
    description="AI-Powered CAD Generation for NWO Robotics",
    long_description=long_description,
    long_description_content_type="text/markdown",
    url="https://github.com/RedCiprianPater/nwo-text-cad",
    packages=find_packages(),
    classifiers=[
        "Development Status :: 3 - Alpha",
        "Intended Audience :: Developers",
        "Intended Audience :: Manufacturing",
        "License :: OSI Approved :: MIT License",
        "Operating System :: OS Independent",
        "Programming Language :: Python :: 3",
        "Programming Language :: Python :: 3.11",
        "Programming Language :: Python :: 3.12",
        "Topic :: Scientific/Engineering :: CAD",
        "Topic :: Software Development :: Libraries :: Python Modules",
    ],
    python_requires=">=3.11",
    install_requires=[
        "build123d>=0.8.0",
        "numpy>=1.24.0",
        "typing-extensions>=4.0.0",
    ],
    extras_require={
        "dev": [
            "pytest>=7.0",
            "black>=23.0",
            "mypy>=1.0",
        ],
        "nwo": [
            "nwo-robotics>=1.0.0",
        ],
    },
    entry_points={
        "console_scripts": [
            "nwo-cad=nwo_text_cad.cli.cad:main",
            "nwo-urdf=nwo_text_cad.cli.urdf:main",
            "nwo-sdf=nwo_text_cad.cli.sdf:main",
            "nwo-assembly=nwo_text_cad.cli.assembly:main",
            "nwo-production=nwo_text_cad.cli.production:main",
        ],
    },
    include_package_data=True,
    zip_safe=False,
)
