using System;
using System.Threading;

class Program {
    static void Main(string[] args) {
        int sec = 60;
        if (args.Length > 0) {
            int s;
            if (int.TryParse(args[0], out s)) {
                sec = s;
            }
        }
        Thread.Sleep(sec * 1000);
    }
}
