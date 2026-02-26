# Sequence: Theme Toggle

**Requirements:** R351, R352, R353, R354, R368, R369

## Page Load (Restore Theme)

```
Browser                ThemeProvider          localStorage         document
  |                       |                      |                    |
  |---mount App---------->|                      |                    |
  |                       |---getItem("hom-th")->|                    |
  |                       |<--"dark"|"light"|null-|                    |
  |                       |                      |                    |
  |                       |---[null => "dark"]--->|                    |
  |                       |                      |                    |
  |                       |---applyCssVars------->|                    |
  |                       |                       |---set CSS vars--->|
  |                       |                      |                    |
  |<--render children------|                      |                    |
  |                       |                      |                    |
```

## User Clicks Toggle

```
User                  Sidebar              useTheme()           ThemeProvider       localStorage
  |                      |                      |                    |                   |
  |---click toggle------>|                      |                    |                   |
  |                      |---toggleTheme()----->|                    |                   |
  |                      |                      |---setState-------->|                   |
  |                      |                      |                    |---setItem--------->|
  |                      |                      |                    |---applyCssVars---->|
  |                      |                      |                    |                   |
  |<---re-render all with new palette-----------+--------------------+                   |
  |                      |                      |                    |                   |
```
