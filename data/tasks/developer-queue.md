# Bio-Sync Academy Developer Task Queue
# 
# This file is the sole source of tasks for the Developer Agent.
# The agent reads this file, picks the highest-priority item, executes it
# (with backup+test safeguards), and marks it complete.
#
# Format:
# ## [P1/P2/P3] Task Title
# **Status:** pending | in-progress | completed
# **Source:** (which agent requested this: Health, SEO, Revenue, Christian)
# **Description:** Clear, specific instructions — enough for the agent to act on
# **Expected Outcome:** What "done" looks like
# **SMELL CHECK:** None — just a marker. If something smells off (vague, risky, broad), the agent must SMS Christian first.
#
# ---
# (tasks appear below as they're added)
