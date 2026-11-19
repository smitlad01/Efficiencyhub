# Contributing to EfficiencyHub

Thank you for your interest in contributing to EfficiencyHub! We welcome contributions to make Windows cleaner, faster, and more energy-efficient for everyone.

---

## Code of Conduct

We are committed to providing a welcoming and harassment-free environment for all contributors. Please be respectful and constructive in all discussions.

---

## Development Setup

1. **Clone the repository**:
   ```cmd
   git clone https://github.com/smitlad01/Efficiencyhub.git
   cd Efficiencyhub
   ```

2. **Install dependencies**:
   ```cmd
   npm install
   ```

3. **Compile the background C# daemon**:
   ```cmd
   csc /target:winexe /optimize+ /out:AutoEfficiencyWatcher.exe AutoEfficiencyWatcher.cs
   ```

4. **Start the local server**:
   ```cmd
   node server.js
   ```

5. **Run the automated test suite**:
   ```cmd
   npm test
   ```

---

## Testing Guidelines

EfficiencyHub maintains an automated End-to-End test suite across four tiers:
- **Tier 1**: Feature specification contracts (R1–R7)
- **Tier 2**: Boundary conditions and error defense
- **Tier 3**: Pairwise cross-feature interactions
- **Tier 4**: Real-world operational workflows

Before submitting a Pull Request, ensure all 82 tests pass:
```cmd
node tests/run_all_e2e.js
```

---

## Pull Request Process

1. Create a feature branch (`git checkout -b feature/my-feature`).
2. Implement your changes following standard Win32 security and userland safety guidelines.
3. Add unit or E2E tests for new features.
4. Verify tests and linting.
5. Submit your Pull Request targeting the `main` branch with a clear description of the problem solved.
