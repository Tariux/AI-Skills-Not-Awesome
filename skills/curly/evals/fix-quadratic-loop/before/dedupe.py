def dedupe(xs):
    out = []
    for x in xs:
        if x not in out:
            out.append(x)
    return out
