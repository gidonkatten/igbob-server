import sys
from pyteal import *
from utils import parseArgs


def contract(args):
    return If(
        Int(1) == Int(args['ARG_INT']),
        Int(1),
        Int(0)
    )


if __name__ == "__main__":
    # Overwrite params if sys.argv[1] is passed
    if len(sys.argv) > 1:
        params = parseArgs(sys.argv[1], {})

    print(compileTeal(contract(params), Mode.Application, version=3))
