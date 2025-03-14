package intol.dti;

import java.io.Console;
import java.io.IOException;
import java.util.Map;

public class InteractiveClient {

        public static void main(String[] args) throws IOException {
        int clientId = (args.length > 0) ? Integer.parseInt(args[0]) : 1001;
        DTI<Integer, String> dti = new DTI<>(clientId);

        Console console = System.console();

        System.out.println("\nCommands:\n");
        System.out.println("\tCOINS: get the IDs and values of your coins");
        System.out.println("\tMINT: Create a coin with a certain value");
        System.out.println("\tSPEND: Send your coins to another user");

        while (true) {
            String cmd = console.readLine("\n  > ");

            if(cmd.equalsIgnoreCase("COINS")) {
                //invokes the op on the servers
                Map<Integer,Float> coins = dti.getCoins();
                for (Map.Entry<Integer,Float> entry : coins.entrySet()) {
                    Integer key = entry.getKey();
                    Float value = entry.getValue();
                    System.out.println("\nValue associated with " + key + ": " + value + "\n");
                }
            } else if(cmd.equalsIgnoreCase("MINT")) {
                //TODO
            } else if(cmd.equalsIgnoreCase("SPEND")) {
                //TODO
            }

        }

    }
}
