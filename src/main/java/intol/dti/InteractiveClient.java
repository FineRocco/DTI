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
                Map<Integer,String> coins = dti.getCoins();
                if(coins == null) {
                    System.out.println("\nYou have no coins");
                    continue;
                }
                int totalValue = 0;
                for (Map.Entry<Integer,String> entry : coins.entrySet()) {
                    Integer key = entry.getKey();
                    String valueStr = entry.getValue();
                    try {
                        Float value = Float.parseFloat(valueStr);
                        totalValue += value;
                        System.out.println("\nValue associated with " + key + ": " + value);
                    } catch (NumberFormatException e) {
                        System.out.println("\nInvalid value format for key " + key + ": " + valueStr + "\n");
                    }
                }
                System.out.println("\nTotal value is: " + totalValue);
            } else if(cmd.equalsIgnoreCase("MINT")) {
                Float value;
                try {
                    value = Float.parseFloat(console.readLine("Enter a numeric value: "));
                } catch (NumberFormatException e) {
                    System.out.println("\tThe value is supposed to be a number!\n");
                    continue;
                }

                //invokes the op on the servers
                Integer coinId = dti.mint(value);

                System.out.println("\nCoin created with ID: " + coinId + " with value: " + value);
            } else if(cmd.equalsIgnoreCase("SPEND")) {
                //TODO
            }

        }

    }
}
