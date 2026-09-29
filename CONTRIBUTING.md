# Contributing to SolidWorks MCP Server

We love your input! We want to make contributing to this project as easy and transparent as possible.

## Development Process

We use GitHub to host code, to track issues and feature requests, as well as accept pull requests.

1. Fork the repo and create your branch from `main`
2. If you've added code that should be tested, add tests
3. If you've changed APIs, update the documentation
4. Ensure the test suite passes
5. Make sure your code lints
6. Issue that pull request!

## Pull Request Process

1. Update the README.md with details of changes to the interface
2. Update the CHANGELOG.md with a note describing your changes
3. The PR will be merged once you have the sign-off of at least one maintainer

## Any contributions you make will be under the MIT Software License

When you submit code changes, your submissions are understood to be under the same [MIT License](LICENSE) that covers the project.

## Report bugs using GitHub's [issues](https://github.com/vespo92/SolidworksMCP-TS/issues)

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/vespo92/SolidworksMCP-TS/issues/new).

## Write bug reports with detail, background, and sample code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

## Development Setup

```bash
# Clone your fork
git clone https://github.com/vespo92/SolidworksMCP-TS.git
cd SolidworksMCP-TS

# Install dependencies
npm install

# Run tests
npm test

# Run in development mode
npm run dev
```

## Testing

- Write tests for any new functionality
- Ensure all tests pass before submitting PR
- Test with actual SolidWorks installation when possible

## Code Style

- Use TypeScript for all new code
- Follow the existing code style (enforced by ESLint/Prettier)
- Run `npm run lint` before committing
- Use meaningful variable and function names
- Add comments for complex logic

## Adding New Tools

To add a new tool:

1. Create the tool in the appropriate file in `src/tools/`
2. Follow the existing pattern with Zod schemas
3. Add comprehensive error handling
4. Update the README with the new tool documentation
5. Add tests for the new functionality

## License

By contributing, you agree that your contributions will be licensed under its MIT License.