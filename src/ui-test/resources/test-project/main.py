from math import sqrt

array = []


def main():
    total = 0
    for i in range(10_000_000):
        total += sqrt(i)
        array.append(total)


if __name__ == "__main__":
    main()
